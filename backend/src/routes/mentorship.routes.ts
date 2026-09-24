import { Router } from 'express'
import { z } from 'zod'
import { query, withTransaction } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'
import { getSubscription } from '../subscription.js'
import { getProfileStats, refreshBadges, stampMutualConfirmation } from '../sessionStats.js'

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
  service_id: string | null
  requested_by: 'mentor' | 'mentee'
  mentee_confirmed: boolean
  mentor_confirmed: boolean
}

const SESSION_SELECT = `
  SELECT s.id, s.mentor_id, s.mentee_id, u.name AS mentee_name, s.topic, s.date_label, s.time_label, s.status, s.meeting_link, s.rating, s.is_paid, s.price, s.service_id, s.requested_by, s.mentee_confirmed, s.mentor_confirmed
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
    serviceId: r.service_id ?? undefined,
    requestedBy: r.requested_by,
    // Both halves of the mutual-confirmation pair, so the UI can show whose
    // turn it is — without these the mentee had no way to see (or act on) a
    // session waiting for their confirmation.
    menteeConfirmed: r.mentee_confirmed,
    mentorConfirmed: r.mentor_confirmed,
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
  // Set when booking a Career Guidance alumni_service rather than a plain
  // mentorship session — see career.routes.ts. Optional, and when absent the
  // booking behaves exactly as it always has (free-allowance pricing below).
  serviceId: z.string().optional(),
})

// POST /api/mentorship/sessions — book a session with a mentor.
mentorshipRouter.post(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = bookSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { mentorId, topic, date, time, serviceId } = parsed.data
    if (mentorId === req.user!.sub) throw new ApiError(400, 'Cannot book a session with yourself')

    const mentor = await query<{ name: string; is_mentor: boolean; mentor_rate: number | null }>(
      `SELECT name, is_mentor, mentor_rate FROM users WHERE id = $1`,
      [mentorId],
    )
    if (!mentor.rowCount) throw new ApiError(404, 'Mentor not found')
    if (!mentor.rows[0].is_mentor) throw new ApiError(400, 'This member is not a mentor')

    // A service booking snapshots that service's own pricing instead of the
    // mentee's generic free-allowance count — the service's price is what was
    // shown on the card the member clicked "Book" on.
    let service: { pricing_mode: string; amount: number | null } | null = null
    if (serviceId) {
      const s = await query<{ pricing_mode: string; amount: number | null }>(
        `SELECT pricing_mode, amount FROM alumni_services WHERE id = $1 AND user_id = $2 AND active`,
        [serviceId, mentorId],
      )
      if (!s.rowCount) throw new ApiError(404, 'That service is no longer available')
      service = s.rows[0]
    }

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

      let isPaid: boolean
      let price: number
      if (service) {
        isPaid = service.pricing_mode !== 'free'
        price = service.pricing_mode === 'paid' ? service.amount ?? 0 : 0
      } else {
        // Free allowance: the mentee's first FREE_SESSIONS non-declined sessions
        // are free; beyond that the session is paid at the mentor's rate.
        // Only sessions this member asked for count against their own free
        // allowance. A mentor offering their time for free must not burn the
        // mentee's allowance — they never spent it.
        const used = await client.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM mentorship_sessions
            WHERE mentee_id = $1 AND status <> 'declined' AND requested_by = 'mentee'`,
          [req.user!.sub],
        )
        isPaid = used.rows[0].n >= FREE_SESSIONS
        price = isPaid ? mentorRate : 0
      }

      return client.query<{ id: string }>(
        `INSERT INTO mentorship_sessions (mentor_id, mentee_id, topic, date_label, time_label, status, is_paid, price, service_id)
         VALUES ($1, $2, $3, $4, $5, 'requested', $6, $7, $8) RETURNING id`,
        [mentorId, req.user!.sub, topic, date, time, isPaid, price, serviceId ?? null],
      )
    })
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      mentorId,
      'mentorship',
      `${me.rows[0].name} requested a mentorship session: "${topic}" on ${date} at ${time}.`,
      req.user!.sub,
      { type: 'session', id: ins.rows[0].id },
    )

    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [ins.rows[0].id])
    res.status(201).json(mapSession(full.rows[0]))
  }),
)

const offerSchema = z.object({
  menteeId: z.string().min(1, 'menteeId is required'),
  topic: z.string().trim().min(1, 'topic is required'),
  date: z.string().trim().min(1, 'date is required'),
  time: z.string().trim().min(1, 'time is required'),
  // The offering mentor sets the link up front: unlike a mentee's request,
  // there is no later "accept" step on the mentor's side to attach one at,
  // so without this an offered session could never get a join link at all.
  meetingLink: z.string().trim().url().optional().or(z.literal('')),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
})

// POST /api/mentorship/sessions/offer — a mentor proactively offers a
// specific connection a 1:1 session, the reverse of the usual booking flow
// (mentee picks a mentor and requests). Restricted to connections, same rule
// invite-only group sessions use, so this can't become a way to cold-message
// anyone. Free — a mentor giving their own time away is a different thing
// from a mentee's paid-after-the-free-allowance booking, and mixing the two
// would tangle this into FREE_SESSIONS accounting that doesn't apply here.
mentorshipRouter.post(
  '/sessions/offer',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = offerSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { menteeId, topic, date, time, meetingLink, scheduledAt } = parsed.data
    const when = scheduledAt ? new Date(scheduledAt) : null
    if (menteeId === req.user!.sub) throw new ApiError(400, 'Cannot offer yourself a session')

    const me = await query<{ name: string; is_mentor: boolean }>(`SELECT name, is_mentor FROM users WHERE id = $1`, [req.user!.sub])
    if (!me.rows[0]?.is_mentor) throw new ApiError(403, 'Only approved mentors can host a session')

    // The paywall gate lands here rather than on the mentee's later
    // acceptance: offering the slot is the mentor's commitment, the same
    // moment accepting a mentee's request would be gated.
    const sub = await getSubscription(req.user!.sub)
    if (!sub.canAcceptSessions) {
      throw new ApiError(402, sub.blockedReason ?? 'Hosting a session needs an active plan.')
    }

    const target = await query('SELECT 1 FROM users WHERE id = $1', [menteeId])
    if (!target.rowCount) throw new ApiError(404, 'Member not found')

    const connected = await query(
      `SELECT 1 FROM connections
        WHERE status = 'accepted'
          AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [req.user!.sub, menteeId],
    )
    if (!connected.rowCount) throw new ApiError(403, 'You can only offer a session to a connection.')

    const dup = await query(
      `SELECT 1 FROM mentorship_sessions WHERE mentor_id = $1 AND mentee_id = $2 AND status = 'requested'`,
      [req.user!.sub, menteeId],
    )
    if (dup.rowCount) throw new ApiError(409, 'You already have a pending offer with them.')

    const ins = await query<{ id: string }>(
      `INSERT INTO mentorship_sessions
         (mentor_id, mentee_id, topic, date_label, time_label, status, is_paid, price,
          requested_by, meeting_link, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, 'requested', FALSE, 0, 'mentor', $6, $7) RETURNING id`,
      [
        req.user!.sub, menteeId, topic, date, time,
        meetingLink || null,
        when && !Number.isNaN(when.getTime()) ? when : null,
      ],
    )
    void pushNotification(
      menteeId,
      'mentorship',
      `${me.rows[0].name} offered you a mentorship session: "${topic}" on ${date} at ${time}.`,
      req.user!.sub,
      { type: 'session', id: ins.rows[0].id },
    )

    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [ins.rows[0].id])
    res.status(201).json(mapSession(full.rows[0]))
  }),
)

// Fetch a session and assert the caller is its mentor.
async function sessionForMentor(id: string, me: string) {
  const r = await query<{
    mentee_id: string; topic: string; status: string; date_label: string; time_label: string
    requested_by: 'mentor' | 'mentee'
  }>(
    `SELECT mentee_id, topic, status, date_label, time_label, requested_by
       FROM mentorship_sessions WHERE id = $1 AND mentor_id = $2`,
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
    // A slot this mentor offered is waiting on the *mentee* — accepting it
    // here would confirm a session the other side never agreed to.
    if (s.requested_by === 'mentor') {
      throw new ApiError(400, "That's a slot you offered — it's waiting for them to accept it.")
    }

    // The subscription gate. Giving a session is what a mentor pays for, so
    // it is checked here rather than at booking — a mentee is never blocked
    // by someone else's billing, and a request already sent stays in the
    // mentor's queue until they sort their plan out.
    //
    // 402 (not 403) so the client can tell "you need to pay" apart from
    // "you're not allowed", and open the plans instead of an error toast.
    const sub = await getSubscription(req.user!.sub)
    if (!sub.canAcceptSessions) {
      throw new ApiError(402, sub.blockedReason ?? 'Accepting a session needs an active plan.')
    }

    const link = typeof req.body?.meetingLink === 'string' ? req.body.meetingLink.trim().slice(0, 500) : ''
    // scheduled_at is optional and additive: the free-text date/time labels
    // stay the source of truth for display, while this gives the profile
    // stats something they can actually count.
    const when = typeof req.body?.scheduledAt === 'string' ? new Date(req.body.scheduledAt) : null
    const scheduledAt = when && !Number.isNaN(when.getTime()) ? when : null
    await query(
      `UPDATE mentorship_sessions
          SET status = 'upcoming', meeting_link = $2, scheduled_at = COALESCE($3, scheduled_at),
              accepted_at = now()
        WHERE id = $1`,
      [req.params.id, link || null, scheduledAt],
    )
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentee_id,
      'mentorship',
      `${me.rows[0].name} confirmed your session "${s.topic}" — ${s.date_label} at ${s.time_label}.` +
        (link ? ' Meeting link attached — see My Sessions.' : ''),
      req.user!.sub,
      { type: 'session', id: req.params.id },
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
      // The same action means two different things depending on who asked:
      // declining a request, or withdrawing a slot you offered.
      s.requested_by === 'mentor'
        ? `${me.rows[0].name} withdrew the session they offered you: "${s.topic}".`
        : `${me.rows[0].name} declined your session request "${s.topic}". You can request another slot.`,
      req.user!.sub,
      { type: 'session', id: req.params.id },
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

const linkSchema = z.object({
  meetingLink: z.string().trim().url().or(z.literal('')),
})

// POST /api/mentorship/sessions/:id/meeting-link — the mentor adds or
// changes where the session actually happens.
//
// Until now a link could only be attached in the one instant the mentor
// accepted a request, and only for requests — a mentor who confirmed without
// one, or who offered the slot themselves, left the other side with a
// "Confirmed" session and no way to join it. Passing '' clears the link.
mentorshipRouter.post(
  '/sessions/:id/meeting-link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = linkSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, 'A valid https:// link is required')

    const s = await sessionForMentor(req.params.id, req.user!.sub)
    if (s.status !== 'requested' && s.status !== 'upcoming') {
      throw new ApiError(400, `A ${s.status} session's link cannot be changed`)
    }

    await query(`UPDATE mentorship_sessions SET meeting_link = $2 WHERE id = $1`, [
      req.params.id,
      parsed.data.meetingLink || null,
    ])
    if (parsed.data.meetingLink) {
      const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
      void pushNotification(
        s.mentee_id,
        'mentorship',
        `${me.rows[0].name} added a meeting link for "${s.topic}" — see My Sessions.`,
        req.user!.sub,
        { type: 'session', id: req.params.id },
      )
    }
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// POST /api/mentorship/sessions/:id/cancel — either side calls off a session
// that hasn't happened. Until now nothing could: a mentee couldn't withdraw a
// request, and neither side could call off a confirmed slot, so a session
// nobody intended to attend sat in both queues forever.
//
// It lands on 'declined' rather than a new status: that is already the
// "didn't happen" state the UI renders and the free-allowance count skips,
// and adding a fifth status would mean touching every filter and query that
// reads one, for no behavioural gain.
mentorshipRouter.post(
  '/sessions/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const r = await query<{ mentor_id: string; mentee_id: string; topic: string; status: string }>(
      `SELECT mentor_id, mentee_id, topic, status FROM mentorship_sessions
        WHERE id = $1 AND (mentor_id = $2 OR mentee_id = $2)`,
      [req.params.id, me],
    )
    if (!r.rowCount) throw new ApiError(404, 'Session not found (or you are not part of it)')
    const s = r.rows[0]
    if (s.status !== 'requested' && s.status !== 'upcoming') {
      throw new ApiError(400, `A ${s.status} session cannot be cancelled`)
    }

    await query(`UPDATE mentorship_sessions SET status = 'declined' WHERE id = $1`, [req.params.id])

    const other = s.mentor_id === me ? s.mentee_id : s.mentor_id
    const mine = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
    void pushNotification(
      other,
      'mentorship',
      s.status === 'requested'
        ? `${mine.rows[0].name} withdrew the session "${s.topic}".`
        : `${mine.rows[0].name} cancelled your upcoming session "${s.topic}".`,
      me,
      { type: 'session', id: req.params.id },
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// Fetch a session and assert the caller is its mentee, and that it's an
// offer (requested_by = 'mentor') — an ordinary mentee-initiated request
// waiting on the mentor must not be silently no-op'd through this path.
async function sessionForOfferedMentee(id: string, me: string) {
  const r = await query<{ mentor_id: string; topic: string; status: string; date_label: string; time_label: string; requested_by: string }>(
    `SELECT mentor_id, topic, status, date_label, time_label, requested_by FROM mentorship_sessions WHERE id = $1 AND mentee_id = $2`,
    [id, me],
  )
  if (!r.rowCount) throw new ApiError(404, 'Session not found (or you are not its mentee)')
  if (r.rows[0].requested_by !== 'mentor') throw new ApiError(400, 'That session was not offered by a mentor')
  return r.rows[0]
}

// POST /api/mentorship/sessions/:id/accept-offer — mentee accepts a
// mentor-initiated offer. No subscription gate: the mentor already committed
// (and was gated) when they made the offer; a mentee accepting one was
// never billed for anything, same as before this flow existed.
mentorshipRouter.post(
  '/sessions/:id/accept-offer',
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await sessionForOfferedMentee(req.params.id, req.user!.sub)
    if (s.status !== 'requested') throw new ApiError(400, `Session is already ${s.status}`)

    await query(
      `UPDATE mentorship_sessions
          SET status = 'upcoming', accepted_at = now()
        WHERE id = $1 AND requested_by = 'mentor'`,
      [req.params.id],
    )
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentor_id,
      'mentorship',
      `${me.rows[0].name} accepted your session offer "${s.topic}" — ${s.date_label} at ${s.time_label}.`,
      req.user!.sub,
      { type: 'session', id: req.params.id },
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// POST /api/mentorship/sessions/:id/decline-offer — mentee declines a
// mentor-initiated offer.
mentorshipRouter.post(
  '/sessions/:id/decline-offer',
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await sessionForOfferedMentee(req.params.id, req.user!.sub)
    if (s.status !== 'requested') throw new ApiError(400, `Session is already ${s.status}`)

    await query(
      `UPDATE mentorship_sessions SET status = 'declined' WHERE id = $1 AND requested_by = 'mentor'`,
      [req.params.id],
    )
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentor_id,
      'mentorship',
      `${me.rows[0].name} declined your session offer "${s.topic}".`,
      req.user!.sub,
      { type: 'session', id: req.params.id },
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
    // How long it actually ran, and what it covered. Optional so the
    // existing one-click "Mark completed" still works unchanged, but when
    // supplied this is what the public profile stats are built from.
    const mins = Number(req.body?.durationMinutes)
    const durationMinutes = Number.isInteger(mins) && mins > 0 && mins <= 600 ? mins : null
    const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim().slice(0, 60) : ''

    // FOR UPDATE + one transaction: without it, a double-click or retried
    // request can both read status = 'upcoming' before either UPDATE
    // commits, both mark it completed, and both increment
    // sessions_conducted — the same race group-session /complete guards
    // against, applied here to the 1:1 session.
    const s = await withTransaction(async (client) => {
      const r = await client.query<{ mentee_id: string; topic: string; status: string }>(
        `SELECT mentee_id, topic, status FROM mentorship_sessions WHERE id = $1 AND mentor_id = $2 FOR UPDATE`,
        [req.params.id, req.user!.sub],
      )
      if (!r.rowCount) throw new ApiError(404, 'Session not found (or you are not its mentor)')
      if (r.rows[0].status !== 'upcoming') throw new ApiError(400, 'Only confirmed (upcoming) sessions can be completed')

      await client.query(
        `UPDATE mentorship_sessions
            SET status = 'past',
                duration_minutes = COALESCE($2, duration_minutes),
                domain = CASE WHEN $3 <> '' THEN $3 ELSE domain END,
                ended_at = COALESCE(ended_at, now()),
                started_at = COALESCE(started_at, scheduled_at),
                -- The mentor saying it happened is one half of the record;
                -- the mentee confirms separately before it counts anywhere.
                mentor_confirmed = TRUE
          WHERE id = $1`,
        [req.params.id, durationMinutes, domain],
      )
      await client.query(
        `UPDATE users SET sessions_conducted = COALESCE(sessions_conducted, 0) + 1 WHERE id = $1`,
        [req.user!.sub],
      )
      return r.rows[0]
    })
    // The mentee hasn't confirmed yet at this point (that's the next step),
    // so this is a no-op today — kept because mentor_confirmed is now TRUE
    // and this is the one place that stamp is checked for.
    await stampMutualConfirmation(req.params.id)

    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentee_id,
      'mentorship',
      `Your session "${s.topic}" with ${me.rows[0].name} is marked completed — confirm it to add it to your learning record. 🎓`,
      req.user!.sub,
      { type: 'session', id: req.params.id },
    )
    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// POST /api/mentorship/sessions/:id/confirm — the mentee's half of the
// record. A session counts toward either profile only once both sides have
// said it happened, which is what stops the public numbers being a claim
// anyone can inflate on their own.
mentorshipRouter.post(
  '/sessions/:id/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const mins = Number(req.body?.durationMinutes)
    const durationMinutes = Number.isInteger(mins) && mins > 0 && mins <= 600 ? mins : null

    // Setting mentee_confirmed and stamping confirmed_at must commit
    // together: if the process died between two separate statements here, a
    // session could end up with both confirmed flags TRUE but confirmed_at
    // never stamped — permanently missing from every stat and badge, since
    // nothing else ever re-triggers this stamp.
    const confirmed = await withTransaction(async (client) => {
      const s = await client.query<{ status: string }>(
        `SELECT status FROM mentorship_sessions WHERE id = $1 AND mentee_id = $2 FOR UPDATE`,
        [req.params.id, req.user!.sub],
      )
      if (!s.rowCount) throw new ApiError(404, 'Session not found (or you are not its mentee)')
      if (s.rows[0].status !== 'past') {
        throw new ApiError(400, 'You can confirm a session once the mentor has marked it completed')
      }
      await client.query(
        `UPDATE mentorship_sessions
            SET mentee_confirmed = TRUE,
                duration_minutes = COALESCE(duration_minutes, $2)
          WHERE id = $1`,
        [req.params.id, durationMinutes],
      )
      return stampMutualConfirmation(req.params.id, client)
    })
    if (confirmed) {
      await refreshBadges(confirmed.mentorId)
      await refreshBadges(confirmed.menteeId)
    }

    const full = await query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [req.params.id])
    res.json(mapSession(full.rows[0]))
  }),
)

// GET /api/mentorship/stats/:userId — the public profile record: sessions,
// hours, rating, streaks and badges, all from mutually-confirmed sessions.
mentorshipRouter.get(
  '/stats/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Event-attendance badges have nothing that "completes" them the way a
    // session confirmation does — an RSVP just quietly becomes "attended"
    // once the event's start time passes. Rechecking on every self-view
    // catches that without a cron job; nothing changes for the common case
    // of viewing someone else's profile.
    if (req.params.userId === req.user!.sub) void refreshBadges(req.params.userId)
    res.json(await getProfileStats(req.params.userId))
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
              -- The verification stamp is what PATCH /api/users/me checks
              -- before letting mentoring be switched on. Nothing a member can
              -- send sets it.
              mentor_verified_at = now(),
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
      { type: 'user', id: req.params.id },
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
    const note = typeof req.body?.reviewNote === 'string' ? req.body.reviewNote.trim().slice(0, 500) : ''
    const upd = await query(
      `UPDATE mentor_applications
          SET status = 'declined', reviewed_by = $2, review_note = $3, updated_at = now()
        WHERE user_id = $1 AND status = 'pending'`,
      [req.params.id, req.user!.sub, note],
    )
    if (upd.rowCount) {
      // Withdraw the listing too: a previously approved member whose later
      // application is declined must not stay bookable on the older decision.
      await query(
        `UPDATE users SET is_mentor = FALSE, willing_to_mentor = FALSE,
                mentor_verified_at = NULL, updated_at = now()
          WHERE id = $1`,
        [req.params.id],
      )
      void pushNotification(
        req.params.id,
        'mentorship',
        `Your mentor application needs another look${note ? `: ${note}` : '. Please resubmit with clearer proof.'}`,
        req.user!.sub,
        { type: 'user', id: req.params.id },
      )
    }
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
      { type: 'session', id: req.params.id },
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

// --- Mentor assessment (admin-recorded) -------------------------------------

/**
 * The score that qualifies someone to mentor this way. Keep in sync with
 * MENTOR_ASSESSMENT_PASS_MARK in frontend/src/lib/profileCompleteness.ts,
 * which decides what the member's own profile tells them they need.
 */
export const MENTOR_ASSESSMENT_PASS_MARK = 60

const assessmentSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  score: z.number().int().min(0).max(100),
  provider: z.string().trim().max(120).optional(),
})

// POST /api/mentorship/assessment — record a member's mentor assessment result.
//
// Admin-only, and deliberately NOT part of PATCH /api/users/me: a score the
// member could set themselves would be worthless as a qualification. Passing
// this (MENTOR_ASSESSMENT_PASS_MARK, above) is one of three ways to qualify to
// mentor, alongside 2+ years of experience and a postgraduate degree.
//
// A pass stamps mentor_verified_at, because an admin recording the score IS
// the verification step for this route — without it the member was told they
// could offer mentorship and then got a 403 from PATCH /api/users/me. It only
// ever GRANTS: a fail never clears a stamp earned through experience or a
// postgraduate degree, which are separate claims.
//
// ponytail: the score is entered by an admin from whatever assessment tool is
// used. Wiring an external provider's webhook straight into this endpoint is
// the upgrade path — it needs that provider's callback payload and a shared
// secret to verify it.
mentorshipRouter.post(
  '/assessment',
  // requireAuth first: requireAdmin only reads req.user, it does not populate
  // it, so on its own it rejects every caller including real admins.
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = assessmentSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { userId, score, provider } = parsed.data

    const passed = score >= MENTOR_ASSESSMENT_PASS_MARK

    const result = await query<{ id: string; score: number; provider: string }>(
      `UPDATE users
          SET mentor_assessment_score = $2,
              mentor_assessment_provider = $3,
              mentor_assessment_at = now(),
              -- COALESCE, not a plain assignment: a member already verified on
              -- another claim keeps their original stamp.
              mentor_verified_at = CASE WHEN $4 THEN COALESCE(mentor_verified_at, now()) ELSE mentor_verified_at END,
              updated_at = now()
        WHERE id = $1
        RETURNING id, mentor_assessment_score AS score, mentor_assessment_provider AS provider`,
      [userId, score, provider ?? '', passed],
    )
    if (!result.rowCount) throw new ApiError(404, 'User not found')

    void pushNotification(
      userId,
      'mentorship',
      passed
        ? `You passed the mentor assessment with ${score}% — you can now offer mentorship from your profile.`
        : `Your mentor assessment score was ${score}%. You need ${MENTOR_ASSESSMENT_PASS_MARK}% to qualify this way.`,
    )
    res.json(result.rows[0])
  }),
)

// --- Mentor applications: member submission + proof documents ---------------
//
// The approval flow above already existed but had no way in: nothing created a
// mentor_applications row, and ticking "willing to mentor" set is_mentor
// directly. These routes close that gap. A member claims ONE requirement,
// attaches evidence, and an admin verifies it; users.mentor_verified_at is
// what PATCH /api/users/me checks before letting mentoring be switched on.

const MENTOR_CLAIMS = ['experience', 'postgrad', 'assessment'] as const

/** What each claim is expected to be evidenced by — echoed to the UI. */
export const MENTOR_CLAIM_LABELS: Record<(typeof MENTOR_CLAIMS)[number], string> = {
  experience: '2+ years of professional experience',
  postgrad: 'A postgraduate degree (Masters or above)',
  assessment: 'A passed mentor assessment (60% or above)',
}

// Certificates and letters arrive as scans as often as PDFs, so images count.
const PROOF_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]
const MAX_PROOF_DOCS = 5
// ~5MB per file ≈ 6.7M base64 chars — the same ceiling as job-application resumes.
const MAX_PROOF_BASE64 = 7_000_000

interface IncomingDoc {
  name: string
  type: string
  data: Buffer
}

/** Validate the uploaded documents before any of them is written. */
function parseProofDocs(raw: unknown): IncomingDoc[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ApiError(400, 'Attach at least one document as proof.')
  }
  if (raw.length > MAX_PROOF_DOCS) {
    throw new ApiError(400, `Please attach at most ${MAX_PROOF_DOCS} documents.`)
  }
  return raw.map((d) => {
    const doc = d as { name?: unknown; dataBase64?: unknown; mediaType?: unknown }
    if (
      typeof doc.name !== 'string' ||
      typeof doc.dataBase64 !== 'string' ||
      typeof doc.mediaType !== 'string' ||
      !PROOF_TYPES.includes(doc.mediaType)
    ) {
      throw new ApiError(400, 'Proof must be a PDF, .docx, JPEG or PNG file.')
    }
    if (doc.dataBase64.length > MAX_PROOF_BASE64) {
      throw new ApiError(413, `"${doc.name.slice(0, 40)}" is too large — keep each file under 5MB.`)
    }
    const data = Buffer.from(doc.dataBase64.replace(/\s/g, ''), 'base64')
    if (!data.length) throw new ApiError(400, `"${doc.name.slice(0, 40)}" was empty — re-attach it.`)
    return { name: doc.name.slice(0, 200), type: doc.mediaType, data }
  })
}

const applySchema = z.object({
  claim: z.enum(MENTOR_CLAIMS),
  note: z.string().trim().max(1000).optional(),
})

// POST /api/mentorship/applications — submit (or resubmit) a mentor application.
mentorshipRouter.post(
  '/applications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = applySchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const docs = parseProofDocs(req.body?.documents)
    const me = req.user!.sub

    const existing = await query<{ status: string }>(
      `SELECT status FROM mentor_applications WHERE user_id = $1`,
      [me],
    )
    if (existing.rows[0]?.status === 'pending') {
      throw new ApiError(409, 'Your application is already under review.')
    }
    if (existing.rows[0]?.status === 'approved') {
      throw new ApiError(409, 'You are already a verified mentor.')
    }

    // Resubmitting after a decline replaces the previous evidence outright:
    // leaving rejected documents attached would mislead the next reviewer.
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO mentor_applications (user_id, status, claim, note, reviewed_by, review_note, updated_at)
         VALUES ($1, 'pending', $2, $3, NULL, '', now())
         ON CONFLICT (user_id) DO UPDATE
           SET status = 'pending', claim = $2, note = $3,
               reviewed_by = NULL, review_note = '', updated_at = now()`,
        [me, parsed.data.claim, parsed.data.note ?? ''],
      )
      await client.query(`DELETE FROM mentor_application_docs WHERE user_id = $1`, [me])
      for (const d of docs) {
        await client.query(
          `INSERT INTO mentor_application_docs (user_id, name, type, data) VALUES ($1, $2, $3, $4)`,
          [me, d.name, d.type, d.data],
        )
      }
    })

    res.json({ status: 'pending', claim: parsed.data.claim, documentCount: docs.length })
  }),
)

interface ApplicationRow {
  user_id: string
  status: 'pending' | 'approved' | 'declined'
  claim: string
  note: string
  review_note: string
  updated_at: Date | string
}

const mapApplication = (r: ApplicationRow, docs: { id: string; name: string; type: string }[]) => ({
  userId: r.user_id,
  status: r.status,
  claim: r.claim || undefined,
  note: r.note || undefined,
  reviewNote: r.review_note || undefined,
  updatedAt: new Date(r.updated_at).toISOString(),
  documents: docs,
})

async function loadApplication(userId: string) {
  const app = await query<ApplicationRow>(
    `SELECT user_id, status, claim, note, review_note, updated_at
       FROM mentor_applications WHERE user_id = $1`,
    [userId],
  )
  if (!app.rowCount) return null
  // Never select `data` here — the metadata drives the UI; the bytes are served
  // one at a time by the download route below.
  const docs = await query<{ id: string; name: string; type: string }>(
    `SELECT id, name, type FROM mentor_application_docs WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  )
  return mapApplication(app.rows[0], docs.rows)
}

// GET /api/mentorship/applications/me — my own application, if I have one.
// Declared before '/applications/:id' so "me" isn't read as a user id.
mentorshipRouter.get(
  '/applications/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await loadApplication(req.user!.sub))
  }),
)

// GET /api/mentorship/applications/:id — one application in full (admin).
mentorshipRouter.get(
  '/applications/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const app = await loadApplication(req.params.id)
    if (!app) throw new ApiError(404, 'No application for this user')
    res.json(app)
  }),
)

// GET /api/mentorship/applications/:id/documents/:docId — download one proof
// document. Admin-only: these are someone's degree certificate and payslips.
mentorshipRouter.get(
  '/applications/:id/documents/:docId',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const r = await query<{ name: string; type: string; data: Buffer }>(
      `SELECT name, type, data FROM mentor_application_docs WHERE id = $1 AND user_id = $2`,
      [req.params.docId, req.params.id],
    )
    const row = r.rows[0]
    if (!row) throw new ApiError(404, 'Document not found')
    res.setHeader('Content-Type', row.type)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${row.name.replace(/[^\w.\- ]/g, '_')}"`,
    )
    res.send(row.data)
  }),
)
