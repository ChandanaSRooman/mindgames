import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { config } from '../config.js'
import {
  emailEnabled,
  INVITE_DEFAULT_BODY,
  INVITE_DEFAULT_SUBJECT,
  INVITE_PLACEHOLDERS,
  INVITE_REQUIRED_PLACEHOLDERS,
  INVITE_TEMPLATE_KEY,
  inviteLinkFor,
  renderTemplate,
} from '../email.js'
import { aiEnabled } from '../ai.js'

// Network-wide overview numbers for the admin console.
import { sendWeeklyDigest } from '../digest.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

// GET /api/admin/stats — one call, everything the dashboard shows.
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const one = async (sql: string): Promise<number> =>
      Number((await query<{ n: string }>(sql)).rows[0].n)

    const [
      members,
      membersThisWeek,
      invitees,
      invited,
      posts,
      comments,
      communities,
      sessionsUpcoming,
      sessionsRequested,
      sessionsCompleted,
      startups,
      pendingMentorApps,
      jobApplications,
      messages,
    ] = await Promise.all([
      one(`SELECT count(*) AS n FROM users WHERE NOT is_admin`),
      one(`SELECT count(*) AS n FROM users WHERE NOT is_admin AND created_at > now() - interval '7 days'`),
      one(`SELECT count(*) AS n FROM invitees`),
      one(`SELECT count(*) AS n FROM invitees WHERE invited_at IS NOT NULL`),
      one(`SELECT count(*) AS n FROM posts`),
      one(`SELECT count(*) AS n FROM comments`),
      one(`SELECT count(*) AS n FROM communities`),
      one(`SELECT count(*) AS n FROM mentorship_sessions WHERE status = 'upcoming'`),
      one(`SELECT count(*) AS n FROM mentorship_sessions WHERE status = 'requested'`),
      one(`SELECT count(*) AS n FROM mentorship_sessions WHERE status = 'past'`),
      one(`SELECT count(*) AS n FROM startups`),
      one(`SELECT count(*) AS n FROM mentor_applications WHERE status = 'pending'`),
      one(`SELECT count(*) AS n FROM job_applications`),
      one(`SELECT count(*) AS n FROM messages`),
    ])

    // Latest sign-ups so the admin can see who joined.
    const recent = await query<{ id: string; name: string; email: string; city: string; created_at: Date }>(
      `SELECT id, name, email, city, created_at FROM users
       WHERE NOT is_admin ORDER BY created_at DESC LIMIT 8`,
    )

    res.json({
      members,
      membersThisWeek,
      invitees,
      invited,
      posts,
      comments,
      communities,
      sessions: { upcoming: sessionsUpcoming, requested: sessionsRequested, completed: sessionsCompleted },
      startups,
      pendingMentorApps,
      jobApplications,
      messages,
      integrations: {
        google: !!config.googleClientId,
        smtp: emailEnabled,
        ai: aiEnabled,
      },
      recentMembers: recent.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        city: r.city,
        joinedAt: new Date(r.created_at).toISOString(),
      })),
    })
  }),
)

// POST /api/admin/digest — send the weekly digest to all opted-in members now.
adminRouter.post(
  '/digest',
  asyncHandler(async (_req, res) => {
    const result = await sendWeeklyDigest()
    res.json(result)
  }),
)


// --- Invite email template -------------------------------------------------
// Admin-editable copy for the credentials email. A row in email_templates is
// an override; no row means the built-in default is in force, so resetting is
// a DELETE rather than writing the default text back (which would then go
// stale the moment the default changed in code).

/** A worked example so the editor's preview shows realistic output. */
const TEMPLATE_SAMPLE = {
  name: 'Asha Rao',
  email: 'asha.rao@example.com',
  password: 'qHB6kbsQCs5m',
  link: inviteLinkFor('asha.rao@example.com'),
}

// GET /api/admin/email-template/invite — current copy plus the defaults, so
// the editor can offer "reset" without a second round trip.
adminRouter.get(
  '/email-template/invite',
  asyncHandler(async (_req, res) => {
    const row = await query<{ subject: string; body: string; updated_at: Date }>(
      `SELECT subject, body, updated_at FROM email_templates WHERE key = $1`,
      [INVITE_TEMPLATE_KEY],
    )
    const custom = row.rows[0]
    res.json({
      subject: custom?.subject ?? INVITE_DEFAULT_SUBJECT,
      body: custom?.body ?? INVITE_DEFAULT_BODY,
      isCustom: !!custom,
      updatedAt: custom ? new Date(custom.updated_at).toISOString() : null,
      defaults: { subject: INVITE_DEFAULT_SUBJECT, body: INVITE_DEFAULT_BODY },
      placeholders: INVITE_PLACEHOLDERS,
      required: INVITE_REQUIRED_PLACEHOLDERS,
      sample: TEMPLATE_SAMPLE,
    })
  }),
)

const templateSchema = z.object({
  subject: z.string().trim().min(1, 'a subject is required').max(200),
  body: z.string().trim().min(1, 'a body is required').max(20_000),
})

// PUT /api/admin/email-template/invite — save an override.
adminRouter.put(
  '/email-template/invite',
  asyncHandler(async (req, res) => {
    const parsed = templateSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { subject, body } = parsed.data

    // An invite without the password or the sign-in link can't be acted on by
    // the recipient — refuse rather than silently mail out a dead end.
    // Probing through renderTemplate (rather than a parallel regex) means this
    // check can't disagree with what the sender will actually substitute.
    const probe = renderTemplate(
      body,
      Object.fromEntries(INVITE_PLACEHOLDERS.map((name) => [name, `<<${name}>>`])),
    )
    const missing = INVITE_REQUIRED_PLACEHOLDERS.filter((name) => !probe.includes(`<<${name}>>`))
    if (missing.length) {
      throw new ApiError(
        400,
        `The body must still include ${missing.map((m) => `{{${m}}}`).join(' and ')} — ` +
          'without it the invited member has no way to sign in.',
      )
    }

    await query(
      `INSERT INTO email_templates (key, subject, body, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE
         SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now()`,
      [INVITE_TEMPLATE_KEY, subject, body],
    )
    res.json({
      ok: true,
      preview: {
        subject: renderTemplate(subject, TEMPLATE_SAMPLE),
        body: renderTemplate(body, TEMPLATE_SAMPLE),
      },
    })
  }),
)

// DELETE /api/admin/email-template/invite — drop the override, back to default.
adminRouter.delete(
  '/email-template/invite',
  asyncHandler(async (_req, res) => {
    await query(`DELETE FROM email_templates WHERE key = $1`, [INVITE_TEMPLATE_KEY])
    res.json({ ok: true, subject: INVITE_DEFAULT_SUBJECT, body: INVITE_DEFAULT_BODY })
  }),
)
