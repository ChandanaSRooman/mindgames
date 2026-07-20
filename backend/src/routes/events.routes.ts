import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification, pushNotificationToAll } from '../notify.js'
import { sendEmail } from '../email.js'

export const eventsRouter = Router()

interface EventRow {
  id: string
  creator_id: string
  title: string
  description: string
  location: string
  meeting_link: string | null
  starts_at: Date
  status: 'pending' | 'approved' | 'rejected'
  is_paid: boolean
  price: number
  rsvp_count: number
  rsvped_by_me: boolean
  attendee_ids: string[]
}

const EVENT_SELECT = `
  SELECT e.id, e.creator_id, e.title, e.description, e.location, e.meeting_link, e.starts_at,
         e.status, e.is_paid, e.price,
         (SELECT count(*)::int FROM event_rsvps r WHERE r.event_id = e.id) AS rsvp_count,
         EXISTS (SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1) AS rsvped_by_me,
         COALESCE((
           SELECT array_agg(r.user_id ORDER BY r.created_at) FROM (
             SELECT user_id, created_at FROM event_rsvps WHERE event_id = e.id
             ORDER BY created_at LIMIT 6
           ) r
         ), '{}') AS attendee_ids
  FROM events e`

function mapEvent(r: EventRow) {
  return {
    id: r.id,
    creatorId: r.creator_id,
    title: r.title,
    description: r.description,
    location: r.location,
    meetingLink: r.meeting_link ?? undefined,
    startsAt: new Date(r.starts_at).toISOString(),
    status: r.status,
    isPaid: r.is_paid,
    price: r.price,
    rsvpCount: r.rsvp_count,
    rsvpedByMe: r.rsvped_by_me,
    attendeeIds: r.attendee_ids ?? [],
  }
}

// GET /api/events — approved events for everyone, plus the caller's own
// pending/rejected ones (so hosts can track a submission). Soonest upcoming
// first, past ones trail.
eventsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<EventRow>(
      `${EVENT_SELECT}
       WHERE e.status = 'approved' OR e.creator_id = $1
       ORDER BY (e.starts_at < now()), e.starts_at`,
      [req.user!.sub],
    )
    res.json(result.rows.map(mapEvent))
  }),
)

// GET /api/events/pending — admin review queue with host names.
eventsRouter.get(
  '/pending',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await query<EventRow & { creator_name: string }>(
      `${EVENT_SELECT.replace('FROM events e', ', u.name AS creator_name FROM events e LEFT JOIN users u ON u.id = e.creator_id')}
       WHERE e.status = 'pending' ORDER BY e.created_at`,
      [req.user!.sub],
    )
    res.json(result.rows.map((r) => ({ ...mapEvent(r), creatorName: r.creator_name ?? 'Unknown' })))
  }),
)

const createSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(140),
  description: z.string().trim().max(2000).default(''),
  location: z.string().trim().max(200).default(''),
  meetingLink: z.string().trim().url().optional().or(z.literal('')),
  startsAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  isPaid: z.boolean().default(false),
  price: z.number().int().min(0).max(1_000_000).default(0),
})

// POST /api/events — request an event. Members' events await admin acceptance
// ('pending') and stay private until then; admin-created ones go live at once.
// The creator auto-RSVPs. The whole-network heads-up fires only once approved.
eventsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const e = parsed.data
    const startsAt = new Date(e.startsAt)
    if (Number.isNaN(+startsAt)) throw new ApiError(400, 'valid start date/time is required')
    if (+startsAt < Date.now() - 60_000) throw new ApiError(400, 'The event must be in the future')
    // A paid event needs a positive price; a free one is always ₹0.
    const isPaid = e.isPaid && e.price > 0
    const price = isPaid ? e.price : 0

    const me = req.user!.sub
    const status = req.user!.isAdmin ? 'approved' : 'pending'
    const inserted = await query<{ id: string }>(
      `INSERT INTO events (creator_id, title, description, location, meeting_link, starts_at, status, is_paid, price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [me, e.title, e.description, e.location, e.meetingLink || null, startsAt, status, isPaid, price],
    )
    await query(`INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2)`, [inserted.rows[0].id, me])

    const creator = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
    if (status === 'approved') {
      const when = startsAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      void pushNotificationToAll(
        'event',
        `${creator.rows[0].name} is hosting "${e.title}" on ${when} — RSVP on the Events page.`,
        me,
      )
    } else {
      // Ask the admins to review a member-created event.
      const admins = await query<{ id: string }>(`SELECT id FROM users WHERE is_admin`)
      for (const a of admins.rows) {
        void pushNotification(
          a.id,
          'event',
          `${creator.rows[0].name} submitted an event for review: "${e.title}".`,
          me,
        )
      }
    }

    const full = await query<EventRow>(`${EVENT_SELECT} WHERE e.id = $2`, [me, inserted.rows[0].id])
    res.status(201).json(mapEvent(full.rows[0]))
  }),
)

// POST /api/events/:id/approve — admin accepts a pending event. The whole
// network is notified (the heads-up that was held back at submission time).
eventsRouter.post(
  '/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query<{ creator_id: string; title: string; starts_at: Date }>(
      `UPDATE events SET status = 'approved' WHERE id = $1 AND status = 'pending'
       RETURNING creator_id, title, starts_at`,
      [req.params.id],
    )
    if (!upd.rowCount) throw new ApiError(404, 'No pending event with this id')
    const { creator_id, title, starts_at } = upd.rows[0]
    const creator = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [creator_id])
    const when = new Date(starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    void pushNotificationToAll(
      'event',
      `${creator.rows[0]?.name ?? 'A member'} is hosting "${title}" on ${when} — RSVP on the Events page.`,
      creator_id,
    )
    void pushNotification(creator_id, 'event', `Your event "${title}" was approved and is now live! 🎉`, req.user!.sub)
    res.json({ ok: true })
  }),
)

// POST /api/events/:id/reject — admin declines a pending event.
eventsRouter.post(
  '/:id/reject',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query<{ creator_id: string; title: string }>(
      `UPDATE events SET status = 'rejected' WHERE id = $1 AND status = 'pending'
       RETURNING creator_id, title`,
      [req.params.id],
    )
    if (!upd.rowCount) throw new ApiError(404, 'No pending event with this id')
    const { creator_id, title } = upd.rows[0]
    void pushNotification(
      creator_id,
      'event',
      `Your event "${title}" was declined. Reach out to the Rooman team for details.`,
      req.user!.sub,
    )
    res.json({ ok: true })
  }),
)

// POST /api/events/:id/rsvp — I'm going (idempotent). DELETE — changed my mind.
eventsRouter.post(
  '/:id/rsvp',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const ev = await query<{ creator_id: string; title: string }>(
      `SELECT creator_id, title FROM events WHERE id = $1`,
      [req.params.id],
    )
    if (!ev.rowCount) throw new ApiError(404, 'Event not found')

    const ins = await query(
      `INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, me],
    )
    if (ins.rowCount && ev.rows[0].creator_id !== me) {
      const who = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
      void pushNotification(
        ev.rows[0].creator_id,
        'event',
        `${who.rows[0].name} is attending your event "${ev.rows[0].title}".`,
        me,
      )
    }
    const full = await query<EventRow>(`${EVENT_SELECT} WHERE e.id = $2`, [me, req.params.id])
    res.json(mapEvent(full.rows[0]))
  }),
)

eventsRouter.delete(
  '/:id/rsvp',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(`DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.sub,
    ])
    const full = await query<EventRow>(`${EVENT_SELECT} WHERE e.id = $2`, [req.user!.sub, req.params.id])
    if (!full.rowCount) throw new ApiError(404, 'Event not found')
    res.json(mapEvent(full.rows[0]))
  }),
)

// DELETE /api/events/:id — cancel. Creator or admin only; attendees are told.
eventsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ev = await query<{ creator_id: string; title: string }>(
      `SELECT creator_id, title FROM events WHERE id = $1`,
      [req.params.id],
    )
    if (!ev.rowCount) throw new ApiError(404, 'Event not found')
    if (ev.rows[0].creator_id !== req.user!.sub && !req.user!.isAdmin) {
      throw new ApiError(403, 'Only the host can cancel this event')
    }
    const attendees = await query<{ user_id: string }>(
      `SELECT user_id FROM event_rsvps WHERE event_id = $1 AND user_id <> $2`,
      [req.params.id, req.user!.sub],
    )
    await query(`DELETE FROM events WHERE id = $1`, [req.params.id])
    for (const a of attendees.rows) {
      void pushNotification(a.user_id, 'event', `The event "${ev.rows[0].title}" was cancelled.`, req.user!.sub)
    }
    res.json({ ok: true })
  }),
)

// GET /api/events/:id/attendees — who's going.
eventsRouter.get(
  '/:id/attendees',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<{ id: string; name: string; designation: string; photo: string | null }>(
      `SELECT u.id, u.name, u.designation, u.photo
       FROM event_rsvps r JOIN users u ON u.id = r.user_id
       WHERE r.event_id = $1 ORDER BY r.created_at`,
      [req.params.id],
    )
    res.json(result.rows.map((r) => ({ ...r, photo: r.photo ?? undefined })))
  }),
)

// GET /api/events/:id/ics — downloadable calendar entry.
eventsRouter.get(
  '/:id/ics',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query<{ id: string; title: string; description: string; location: string; meeting_link: string | null; starts_at: Date }>(
      `SELECT id, title, description, location, meeting_link, starts_at FROM events WHERE id = $1`,
      [req.params.id],
    )
    if (!r.rowCount) throw new ApiError(404, 'Event not found')
    const e = r.rows[0]
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const start = new Date(e.starts_at)
    const end = new Date(+start + 60 * 60 * 1000) // default 1 hour
    const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RooConnect//Alumni Events//EN',
      'BEGIN:VEVENT',
      `UID:rooconnect-event-${e.id}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(e.title)}`,
      e.location ? `LOCATION:${esc(e.location)}` : '',
      `DESCRIPTION:${esc(e.description + (e.meeting_link ? `\nJoin: ${e.meeting_link}` : ''))}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="event.ics"`)
    res.send(ics)
  }),
)

/**
 * Every 15 minutes: remind attendees of events starting within the next 24h
 * (notification + email), once per event.
 */
export function startEventReminderScheduler(): void {
  const tick = async () => {
    try {
      const due = await query<{ id: string; title: string; starts_at: Date; location: string; meeting_link: string | null }>(
        `UPDATE events SET reminded = TRUE
         WHERE NOT reminded AND starts_at BETWEEN now() AND now() + interval '24 hours'
         RETURNING id, title, starts_at, location, meeting_link`,
      )
      for (const e of due.rows) {
        const when = new Date(e.starts_at).toLocaleString('en-IN', {
          weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        })
        const attendees = await query<{ user_id: string; email: string; name: string }>(
          `SELECT r.user_id, u.email, u.name FROM event_rsvps r JOIN users u ON u.id = r.user_id
           WHERE r.event_id = $1`,
          [e.id],
        )
        for (const a of attendees.rows) {
          void pushNotification(a.user_id, 'event', `Reminder: "${e.title}" starts ${when}${e.location ? ` at ${e.location}` : ''}.`)
          void sendEmail(
            a.email,
            `Reminder: ${e.title} — ${when}`,
            `Hi ${a.name},\n\nA reminder that "${e.title}" starts ${when}${e.location ? ` at ${e.location}` : ''}.` +
              (e.meeting_link ? `\nJoin: ${e.meeting_link}` : '') +
              `\n\nSee you there!\n— RooConnect`,
          ).catch(() => {})
        }
      }
      if (due.rowCount) console.log(`Event reminders sent for ${due.rowCount} event(s)`)
    } catch (err) {
      console.error('event reminder scheduler failed:', err instanceof Error ? err.message : err)
    }
  }
  setInterval(tick, 15 * 60 * 1000)
  void tick()
}
