import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'

export const mentorshipRouter = Router()

interface SessionRow {
  id: string
  mentor_id: string
  mentee_id: string
  mentee_name: string
  topic: string
  date_label: string
  time_label: string
  status: 'requested' | 'upcoming' | 'declined' | 'past'
}

const SESSION_SELECT = `
  SELECT s.id, s.mentor_id, s.mentee_id, u.name AS mentee_name, s.topic, s.date_label, s.time_label, s.status
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

    const mentor = await query<{ name: string; is_mentor: boolean }>(
      `SELECT name, is_mentor FROM users WHERE id = $1`,
      [mentorId],
    )
    if (!mentor.rowCount) throw new ApiError(404, 'Mentor not found')
    if (!mentor.rows[0].is_mentor) throw new ApiError(400, 'This member is not a mentor')

    // One pending request per mentor — prevents accidental double-booking.
    const dup = await query(
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

    const ins = await query<{ id: string }>(
      `INSERT INTO mentorship_sessions (mentor_id, mentee_id, topic, date_label, time_label, status)
       VALUES ($1, $2, $3, $4, $5, 'requested') RETURNING id`,
      [mentorId, req.user!.sub, topic, date, time],
    )
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
    await query(`UPDATE mentorship_sessions SET status = 'upcoming' WHERE id = $1`, [req.params.id])
    const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    void pushNotification(
      s.mentee_id,
      'mentorship',
      `${me.rows[0].name} confirmed your session "${s.topic}" — ${s.date_label} at ${s.time_label}.`,
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
