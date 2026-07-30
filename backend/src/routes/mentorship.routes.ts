import { Router } from 'express'
import { z } from 'zod'
import { query, withTransaction } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'

export const mentorshipRouter = Router()

// A mentee's first N sessions are free; the (N+1)th onward is paid at the
// mentor's rate. Keep in sync with FREE_MENTORSHIP_SESSIONS in the frontend.
const FREE_SESSIONS = 3

interface SessionRow {
  id: string
  mentor_id: string
  mentee_id: string
  mentee_name: string
  topic: string
  date_label: string
  time_label: string
  status: 'requested' | 'upcoming' | 'declined' | 'past'
  meeting_link: string | null
  rating: number | null
  is_paid: boolean
  price: number
}

const SESSION_SELECT = `
  SELECT s.id, s.mentor_id, s.mentee_id, u.name AS mentee_name, s.topic, s.date_label, s.time_label, s.status, s.meeting_link, s.rating, s.is_paid, s.price
  FROM mentorship_sessions s
  JOIN users u ON u.id = s.mentee_id`

function mapSession(r: SessionRow) {
  return {
    id: r.id,
    mentorId: r.mentor_id,
    menteeId: r.mentee_id,
    menteeName: r.mentee_name,
    topic: r.topic,
    date: r.date_label,
    time: r.time_label,
    status: r.status,
    meetingLink: r.meeting_link ?? undefined,
    rating: r.rating ?? undefined,
    isPaid: r.is_paid,
    price: r.price,
  }
}

// GET /api/mentorship/sessions — sessions where I'm the mentee or the mentor.
mentorshipRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<SessionRow>(
      `${SESSION_SELECT} WHERE s.mentee_id = $1 OR s.mentor_id = $1
       ORDER BY s.status ASC, s.created_at DESC`,
      [req.user!.sub],
    )
    res.json(result.rows.map(mapSession))
  }),
)

const bookSchema = z.object({
  mentorId: z.string().min(1, 'mentorId is required'),
  topic: z.string().trim().min(1, 'topic is required'),
  date: z.string().trim().min(1, 'date is required'),
  time: z.string().trim().min(1, 'time is required'),
})

// POST /api/mentorship/sessions — book a session with a mentor.
mentorshipRouter.post(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = bookSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { mentorId, topic, date, time } = parsed.data
    if (mentorId === req.user!.sub) throw new ApiError(400, 'Cannot book a session with yourself')

    const mentor = await query<{ name: string; is_mentor: boolean; mentor_rate: number | null }>(
      `SELECT name, is_mentor, mentor_rate FROM users WHERE id = $1`,
      [mentorId],
    )
    if (!mentor.rowCount) throw new ApiError(404, 'Mentor not found')
    if (!mentor.rows[0].is_mentor) throw new ApiError(400, 'This member is not a mentor')

    const mentorRate = mentor.rows[0].mentor_rate ?? 0
    // Duplicate check + free-allowance count + insert run in one transaction with
    // the mentee's row locked, so two concurrent requests can't both read the
    // same "sessions used" count and both be booked as free (mirrors the
    // event-RSVP capacity lock).
    const ins = await withTransaction(async (client) => {
      await client.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [req.user!.sub])

      // One pending request per mentor — prevents accidental double-booking.
      const dup = await client.query(
        `SELECT 1 FROM mentorship_sessions
         WHERE mentor_id = $1 AND mentee_id = $2 AND status = 'requested'`,
        [mentorId, req.user!.sub],
      )
      if (dup.rowCount) {
        throw new ApiError(
          409,
          `You already have a pending request with ${mentor.rows[0].name}. Wait for them to respond.`,
        )
      }

      // Free allowance: the mentee's first FREE_SESSIONS non-declined sessions
      // are free; beyond that the session is paid at the mentor's rate.
      const used = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM mentorship_sessions WHERE mentee_id = $1 AND status <> 'declined'`,
        [req.user!.sub],
      )
      const isPaid = used.rows[0].n >= FREE_SESSIONS
      const price = isPaid ? mentorRate : 0

      return client.query<{ id: string }>(
        `INSERT INTO mentorship_sessions (mentor_id, mentee_id, topic, date_label, time_label, status, is_paid, price)
         VALUES ($1, $2, $3, $4, $5, 'requested', $6, $7) RETURNING id`,
        [mentorId, req.user!.sub, topic, date, time, isPaid, price],
      )
    })
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      mentorId,
      'mentorship',
      `${me.rows[0].name} requested a mentorship session: "${topic}" on ${date} at ${time}.`,
      req.user!.sub,
    )

    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [ins.rows[0].id])
    res.status(201).json(mapSession(full.rows[0]))
  }),
)

// Fetch a session and assert the caller is its mentor.
async function sessionForMentor(id: string, me: string) {
  const r = await query<{ mentee_id: string; topic: string; status: string; date_label: string; time_label: string }>(
    `SELECT mentee_id, topic, status, date_label, time_label FROM mentorship_sessions WHERE id = $1 AND mentor_id = $2`,
    [id, me],
  )
  if (!r.rowCount) throw new ApiError(404, 'Session not found (or you are not its mentor)')
  return r.rows[0]
}

// POST /api/mentorship/sessions/:id/accept — mentor confirms a request.
mentorshipRouter.post(
  '/sessions/:id/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await sessionForMentor(req.params.id, req.user!.sub)
    if (s.status !== 'requested') throw new ApiError(400, `Session is already ${s.status}`)
    const link = typeof req.body?.meetingLink === 'string' ? req.body.meetingLink.trim().slice(0, 500) : ''
    await query(`UPDATE mentorship_sessions SET status = 'upcoming', meeting_link = $2 WHERE id = $1`, [
      req.params.id,
      link || null,
    ])
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentee_id,
      'mentorship',
      `${me.rows[0].name} confirmed your session "${s.topic}" — ${s.date_label} at ${s.time_label}.` +
        (link ? ' Meeting link attached — see My Sessions.' : ''),
      req.user!.sub,
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// POST /api/mentorship/sessions/:id/decline — mentor declines a request.
mentorshipRouter.post(
  '/sessions/:id/decline',
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await sessionForMentor(req.params.id, req.user!.sub)
    if (s.status !== 'requested') throw new ApiError(400, `Session is already ${s.status}`)
    await query(`UPDATE mentorship_sessions SET status = 'declined' WHERE id = $1`, [req.params.id])
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentee_id,
      'mentorship',
      `${me.rows[0].name} declined your session request "${s.topic}". You can request another slot.`,
      req.user!.sub,
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// POST /api/mentorship/sessions/:id/complete — mentor marks a confirmed
// session as done; bumps their sessionsConducted counter.
mentorshipRouter.post(
  '/sessions/:id/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await sessionForMentor(req.params.id, req.user!.sub)
    if (s.status !== 'upcoming') throw new ApiError(400, 'Only confirmed (upcoming) sessions can be completed')
    await query(`UPDATE mentorship_sessions SET status = 'past' WHERE id = $1`, [req.params.id])
    await query(
      `UPDATE users SET sessions_conducted = COALESCE(sessions_conducted, 0) + 1 WHERE id = $1`,
      [req.user!.sub],
    )
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentee_id,
      'mentorship',
      `Your session "${s.topic}" with ${me.rows[0].name} is marked completed. Hope it helped! 🎓`,
      req.user!.sub,
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// --- Mentor applications (admin-approved) -----------------------------------

// GET /api/mentorship/applications — pending applicant user ids (admin).
mentorshipRouter.get(
  '/applications',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await query<{ user_id: string }>(
      `SELECT user_id FROM mentor_applications WHERE status = 'pending' ORDER BY created_at`,
    )
    res.json(result.rows.map((r) => r.user_id))
  }),
)

// POST /api/mentorship/applications/:id/approve — admin approves an applicant.
mentorshipRouter.post(
  '/applications/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query(
      `UPDATE mentor_applications SET status = 'approved', updated_at = now()
       WHERE user_id = $1 AND status = 'pending'`,
      [req.params.id],
    )
    if (!upd.rowCount) throw new ApiError(404, 'No pending application for this user')
    await query(
      `UPDATE users SET is_mentor = TRUE, willing_to_mentor = TRUE,
              mentor_rate = COALESCE(mentor_rate, 1000),
              sessions_conducted = COALESCE(sessions_conducted, 0),
              updated_at = now()
       WHERE id = $1`,
      [req.params.id],
    )
    void pushNotification(
      req.params.id,
      'mentorship',
      'Your mentor application was approved. You are now listed as a mentor! 🎉',
      req.user!.sub,
    )
    res.json({ ok: true })
  }),
)

// POST /api/mentorship/applications/:id/decline — admin declines an applicant.
mentorshipRouter.post(
  '/applications/:id/decline',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE mentor_applications SET status = 'declined', updated_at = now()
       WHERE user_id = $1 AND status = 'pending'`,
      [req.params.id],
    )
    res.json({ ok: true })
  }),
)

// POST /api/mentorship/sessions/:id/rate — mentee rates a completed session.
mentorshipRouter.post(
  '/sessions/:id/rate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rating = Number(req.body?.rating)
    const review = typeof req.body?.review === 'string' ? req.body.review.trim().slice(0, 500) : ''
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'rating must be 1-5')
    }
    const s = await query<{ mentor_id: string; status: string; rating: number | null; topic: string }>(
      `SELECT mentor_id, status, rating, topic FROM mentorship_sessions WHERE id = $1 AND mentee_id = $2`,
      [req.params.id, req.user!.sub],
    )
    if (!s.rowCount) throw new ApiError(404, 'Session not found (or you are not its mentee)')
    if (s.rows[0].status !== 'past') throw new ApiError(400, 'You can rate a session once it is completed')
    if (s.rows[0].rating) throw new ApiError(400, 'You already rated this session')

    await query(`UPDATE mentorship_sessions SET rating = $2, review = $3 WHERE id = $1`, [
      req.params.id,
      rating,
      review || null,
    ])
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.rows[0].mentor_id,
      'mentorship',
      `${me.rows[0].name} rated your session "${s.rows[0].topic}" ${rating}★${review ? ` — "${review.slice(0, 60)}"` : ''}`,
      req.user!.sub,
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// GET /api/mentorship/ratings — average rating per mentor (for mentor cards).
mentorshipRouter.get(
  '/ratings',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await query<{ mentor_id: string; avg: string; count: number }>(
      `SELECT mentor_id, round(avg(rating)::numeric, 1)::text AS avg, count(*)::int AS count
       FROM mentorship_sessions WHERE rating IS NOT NULL GROUP BY mentor_id`,
    )
    res.json(rows.rows.map((r) => ({ mentorId: r.mentor_id, avg: Number(r.avg), count: r.count })))
  }),
)
