import { Router } from 'express'
import { z } from 'zod'
import { query, withTransaction } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification, pushNotificationToAll } from '../notify.js'
import { canHostGroupSessions } from '../subscription.js'
import { recordConfirmedGroupAttendance } from '../sessionStats.js'

export const groupSessionsRouter = Router()

interface GroupSessionRow {
  id: string
  mentor_id: string
  mentor_name: string
  mentor_photo: string | null
  topic: string
  description: string
  domain: string
  scheduled_at: Date
  duration_minutes: number
  capacity: number
  meeting_link: string | null
  pricing_mode: 'free' | 'paid'
  price_per_seat: number
  status: 'scheduled' | 'completed' | 'cancelled'
  attendee_count: number
  joined_by_me: boolean
  mentor_confirmed: boolean
}

const LIST_SELECT = (viewer: string) => `
  SELECT g.id, g.mentor_id, u.name AS mentor_name, u.photo AS mentor_photo,
         g.topic, g.description, g.domain, g.scheduled_at, g.duration_minutes,
         g.capacity, g.meeting_link, g.pricing_mode, g.price_per_seat, g.status, g.mentor_confirmed,
         (SELECT count(*)::int FROM group_session_attendees a WHERE a.session_id = g.id) AS attendee_count,
         EXISTS (SELECT 1 FROM group_session_attendees a WHERE a.session_id = g.id AND a.mentee_id = '${viewer}') AS joined_by_me
    FROM group_sessions g JOIN users u ON u.id = g.mentor_id`

function mapGroupSession(r: GroupSessionRow) {
  return {
    id: r.id,
    mentorId: r.mentor_id,
    mentorName: r.mentor_name,
    mentorPhoto: r.mentor_photo ?? undefined,
    topic: r.topic,
    description: r.description,
    domain: r.domain,
    scheduledAt: new Date(r.scheduled_at).toISOString(),
    durationMinutes: r.duration_minutes,
    capacity: r.capacity,
    attendeeCount: r.attendee_count,
    seatsLeft: Math.max(0, r.capacity - r.attendee_count),
    meetingLink: r.meeting_link ?? undefined,
    pricingMode: r.pricing_mode,
    pricePerSeat: r.price_per_seat,
    status: r.status,
    joinedByMe: r.joined_by_me,
    mentorConfirmed: r.mentor_confirmed,
  }
}

const createSchema = z.object({
  topic: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).optional().default(''),
  domain: z.string().trim().max(60).optional().default(''),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  durationMinutes: z.number().int().min(15).max(480).optional().default(60),
  capacity: z.number().int().min(2).max(500).optional().default(10),
  meetingLink: z.string().trim().url().optional().or(z.literal('')),
  pricingMode: z.enum(['free', 'paid']).optional().default('free'),
  pricePerSeat: z.number().int().min(0).max(1_000_000).optional().default(0),
})

// POST /api/group-sessions — a mentor schedules a session for many mentees
// at once. Gated on the plan's groupSessions flag, not just an active plan —
// mirrors the paid-events gate exactly.
groupSessionsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isMentor = await query<{ is_mentor: boolean }>(`SELECT is_mentor FROM users WHERE id = $1`, [req.user!.sub])
    if (!isMentor.rows[0]?.is_mentor) throw new ApiError(403, 'Only approved mentors can host group sessions.')

    const allowed = await canHostGroupSessions(req.user!.sub)
    if (!allowed.allowed) throw new ApiError(402, allowed.reason ?? 'A plan is needed to host group sessions.')

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const g = parsed.data
    const startsAt = new Date(g.scheduledAt)
    if (Number.isNaN(+startsAt)) throw new ApiError(400, 'A valid date/time is required')
    if (+startsAt < Date.now() - 60_000) throw new ApiError(400, 'The session must be in the future')

    const isPaid = g.pricingMode === 'paid' && g.pricePerSeat > 0
    const ins = await query<{ id: string }>(
      `INSERT INTO group_sessions
         (mentor_id, topic, description, domain, scheduled_at, duration_minutes, capacity,
          meeting_link, pricing_mode, price_per_seat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        req.user!.sub, g.topic, g.description, g.domain, startsAt, g.durationMinutes, g.capacity,
        g.meetingLink || null, isPaid ? 'paid' : 'free', isPaid ? g.pricePerSeat : 0,
      ],
    )

    const mentor = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotificationToAll(
      'mentorship',
      `${mentor.rows[0].name} is hosting a group session: "${g.topic}" — ${g.capacity} seats available.`,
      req.user!.sub,
    )

    const full = await query<GroupSessionRow>(`${LIST_SELECT(req.user!.sub)} WHERE g.id = $1`, [ins.rows[0].id])
    res.status(201).json(mapGroupSession(full.rows[0]))
  }),
)

// GET /api/group-sessions — open sessions any member can browse and join,
// soonest first. Cancelled ones are never listed; completed ones drop off
// once they're in the past (still visible via /mine for the mentor).
groupSessionsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await query<GroupSessionRow>(
      `${LIST_SELECT(req.user!.sub)}
        WHERE g.status = 'scheduled' AND g.scheduled_at > now()
        ORDER BY g.scheduled_at`,
    )
    res.json(rows.rows.map(mapGroupSession))
  }),
)

// GET /api/group-sessions/mine — sessions I host or have joined.
groupSessionsRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await query<GroupSessionRow>(
      `${LIST_SELECT(req.user!.sub)}
        WHERE g.mentor_id = $1
           OR EXISTS (SELECT 1 FROM group_session_attendees a WHERE a.session_id = g.id AND a.mentee_id = $1)
        ORDER BY g.scheduled_at DESC`,
      [req.user!.sub],
    )
    res.json(rows.rows.map(mapGroupSession))
  }),
)

// GET /api/group-sessions/:id/attendees — the mentor's roster, for
// completing the session and seeing who to expect.
groupSessionsRouter.get(
  '/:id/attendees',
  requireAuth,
  asyncHandler(async (req, res) => {
    const owns = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM group_sessions WHERE id = $1 AND mentor_id = $2`,
      [req.params.id, req.user!.sub],
    )
    if (!owns.rows[0].n) throw new ApiError(404, 'Group session not found (or you are not its host)')

    const rows = await query<{
      mentee_id: string; name: string; photo: string | null; joined_at: Date; mentee_confirmed: boolean
    }>(
      `SELECT a.mentee_id, u.name, u.photo, a.joined_at, a.mentee_confirmed
         FROM group_session_attendees a JOIN users u ON u.id = a.mentee_id
        WHERE a.session_id = $1 ORDER BY a.joined_at`,
      [req.params.id],
    )
    res.json(
      rows.rows.map((r) => ({
        id: r.mentee_id,
        name: r.name,
        photo: r.photo ?? undefined,
        joinedAt: r.joined_at.toISOString(),
        confirmed: r.mentee_confirmed,
      })),
    )
  }),
)

// POST /api/group-sessions/:id/join — reserve a seat. Capacity is enforced
// under a row lock, the same pattern event RSVP capacity already uses, so
// two members joining the last seat at once can't both succeed.
groupSessionsRouter.post(
  '/:id/join',
  requireAuth,
  asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
      const g = await client.query<{ mentor_id: string; capacity: number; status: string; topic: string }>(
        `SELECT mentor_id, capacity, status, topic FROM group_sessions WHERE id = $1 FOR UPDATE`,
        [req.params.id],
      )
      if (!g.rowCount) throw new ApiError(404, 'Group session not found')
      const session = g.rows[0]
      if (session.mentor_id === req.user!.sub) throw new ApiError(400, 'You are hosting this session')
      if (session.status !== 'scheduled') throw new ApiError(400, 'This session is no longer open')

      const count = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM group_session_attendees WHERE session_id = $1`,
        [req.params.id],
      )
      if (count.rows[0].n >= session.capacity) throw new ApiError(409, 'This session is full')

      const dup = await client.query(
        `SELECT 1 FROM group_session_attendees WHERE session_id = $1 AND mentee_id = $2`,
        [req.params.id, req.user!.sub],
      )
      if (dup.rowCount) throw new ApiError(409, 'You already joined this session')

      await client.query(
        `INSERT INTO group_session_attendees (session_id, mentee_id) VALUES ($1, $2)`,
        [req.params.id, req.user!.sub],
      )

      const me = await client.query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
      void pushNotification(
        session.mentor_id, 'mentorship',
        `${me.rows[0].name} joined your group session "${session.topic}".`, req.user!.sub,
      )
    })

    const full = await query<GroupSessionRow>(`${LIST_SELECT(req.user!.sub)} WHERE g.id = $1`, [req.params.id])
    res.json(mapGroupSession(full.rows[0]))
  }),
)

// POST /api/group-sessions/:id/leave — give up a seat before it happens.
groupSessionsRouter.post(
  '/:id/leave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const del = await query(
      `DELETE FROM group_session_attendees WHERE session_id = $1 AND mentee_id = $2`,
      [req.params.id, req.user!.sub],
    )
    if (!del.rowCount) throw new ApiError(404, "You haven't joined this session")
    const full = await query<GroupSessionRow>(`${LIST_SELECT(req.user!.sub)} WHERE g.id = $1`, [req.params.id])
    res.json(full.rowCount ? mapGroupSession(full.rows[0]) : { id: req.params.id })
  }),
)

const completeSchema = z.object({
  durationMinutes: z.number().int().min(1).max(600).optional(),
  domain: z.string().trim().max(60).optional(),
})

// POST /api/group-sessions/:id/complete — mentor marks the session done.
// Same two-sided confirmation model as 1:1 sessions, just fanned out over
// every attendee instead of one mentee.
groupSessionsRouter.post(
  '/:id/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const g = await query<{ mentor_id: string; status: string; topic: string }>(
      `SELECT mentor_id, status, topic FROM group_sessions WHERE id = $1`,
      [req.params.id],
    )
    if (!g.rowCount || g.rows[0].mentor_id !== req.user!.sub) {
      throw new ApiError(404, 'Group session not found (or you are not its host)')
    }
    if (g.rows[0].status !== 'scheduled') throw new ApiError(400, `Session is already ${g.rows[0].status}`)

    const parsed = completeSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)

    await query(
      `UPDATE group_sessions SET status = 'completed', mentor_confirmed = TRUE,
              duration_minutes = COALESCE($2, duration_minutes),
              domain = CASE WHEN $3 <> '' THEN $3 ELSE domain END
        WHERE id = $1`,
      [req.params.id, parsed.data.durationMinutes ?? null, parsed.data.domain ?? ''],
    )
    await query(
      `UPDATE users SET sessions_conducted = COALESCE(sessions_conducted, 0) + 1 WHERE id = $1`,
      [req.user!.sub],
    )

    const attendees = await query<{ mentee_id: string }>(
      `SELECT mentee_id FROM group_session_attendees WHERE session_id = $1`,
      [req.params.id],
    )
    for (const a of attendees.rows) {
      void pushNotification(
        a.mentee_id, 'mentorship',
        `"${g.rows[0].topic}" is marked completed — confirm it to add it to your learning record. 🎓`,
        req.user!.sub,
      )
    }

    const full = await query<GroupSessionRow>(`${LIST_SELECT(req.user!.sub)} WHERE g.id = $1`, [req.params.id])
    res.json(mapGroupSession(full.rows[0]))
  }),
)

// POST /api/group-sessions/:id/confirm — an attendee confirms they were
// there. Only once both this and the mentor's completion exist does the
// seat count toward either profile's stats/badges.
groupSessionsRouter.post(
  '/:id/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const g = await query<{ status: string }>(`SELECT status FROM group_sessions WHERE id = $1`, [req.params.id])
    if (!g.rowCount) throw new ApiError(404, 'Group session not found')
    if (g.rows[0].status !== 'completed') {
      throw new ApiError(400, 'You can confirm once the mentor has marked the session completed')
    }
    const upd = await query(
      `UPDATE group_session_attendees SET mentee_confirmed = TRUE, confirmed_at = COALESCE(confirmed_at, now())
        WHERE session_id = $1 AND mentee_id = $2`,
      [req.params.id, req.user!.sub],
    )
    if (!upd.rowCount) throw new ApiError(404, "You didn't attend this session")
    await recordConfirmedGroupAttendance(req.params.id, req.user!.sub)

    const full = await query<GroupSessionRow>(`${LIST_SELECT(req.user!.sub)} WHERE g.id = $1`, [req.params.id])
    res.json(mapGroupSession(full.rows[0]))
  }),
)

// POST /api/group-sessions/:id/cancel — mentor cancels before it happens.
groupSessionsRouter.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const g = await query<{ mentor_id: string; topic: string; status: string }>(
      `SELECT mentor_id, topic, status FROM group_sessions WHERE id = $1`,
      [req.params.id],
    )
    if (!g.rowCount || g.rows[0].mentor_id !== req.user!.sub) {
      throw new ApiError(404, 'Group session not found (or you are not its host)')
    }
    if (g.rows[0].status !== 'scheduled') throw new ApiError(400, `Session is already ${g.rows[0].status}`)

    await query(`UPDATE group_sessions SET status = 'cancelled' WHERE id = $1`, [req.params.id])
    const attendees = await query<{ mentee_id: string }>(
      `SELECT mentee_id FROM group_session_attendees WHERE session_id = $1`,
      [req.params.id],
    )
    for (const a of attendees.rows) {
      void pushNotification(
        a.mentee_id, 'mentorship',
        `"${g.rows[0].topic}" was cancelled by the host.`, req.user!.sub,
      )
    }
    res.json({ ok: true })
  }),
)
