import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { asyncHandler, ApiError } from '../http.js'
import { mapInvitee, type InviteeRow } from '../mappers.js'
import {
  INVITE_DEFAULT_BODY,
  INVITE_DEFAULT_SUBJECT,
  INVITE_TEMPLATE_KEY,
  PASSWORD_REDACTED,
  inviteLinkFor,
  renderTemplate,
} from '../email.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'

// Admin "alumni directory" — contacts to invite. Kept under /api/alumni so the
// existing Admin UI (AdminDashboard, AlumniTable) works unchanged.
// Admin-only: sign in as the official account (network@rooman.com).
export const inviteesRouter = Router()
inviteesRouter.use(requireAuth, requireAdmin)

const INVITEE_COLS = `id, name, phone, email, role, batch_year, status_tags,
  invited_at, invite_status, invite_error, invite_count, batch_label`

inviteesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await query<InviteeRow>(
      `SELECT i.id, i.name, i.phone, i.email, i.role, i.batch_year, i.status_tags,
              i.invited_at, i.invite_status, i.invite_error, i.invite_count, i.batch_label,
              (u.id IS NOT NULL)                         AS has_account,
              (u.id IS NOT NULL AND NOT u.must_change_password) AS password_changed,
              u.last_login_at,
              -- See admin.routes.ts: member-authored content proves a
              -- sign-in for accounts predating last_login_at. Must not read
              -- updated_at — re-issuing an invite password bumps it, which
              -- would mark the member "signed in" and hide them from the
              -- very filters used to chase them up.
              (u.id IS NOT NULL
                AND (u.course <> '' OR u.bio <> '' OR u.city <> '' OR u.photo IS NOT NULL))
                AS ever_active
         FROM invitees i
         LEFT JOIN users u ON lower(u.email) = lower(i.email)
        ORDER BY i.created_at`,
    )
    res.json(result.rows.map(mapInvitee))
  }),
)

const addSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().email('valid email is required'),
  phone: z.string().optional(),
})

/** Batch label for people typed in one at a time rather than imported. */
const MANUAL_BATCH = 'Added individually'

inviteesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = addSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { name, email, phone } = parsed.data

    const dup = await query('SELECT 1 FROM invitees WHERE lower(email) = lower($1)', [email])
    if (dup.rowCount) throw new ApiError(409, 'An alumnus with this email already exists')

    const result = await query<InviteeRow>(
      `INSERT INTO invitees (name, phone, email, batch_label) VALUES ($1, $2, $3, $4)
       RETURNING ${INVITEE_COLS}`,
      [name, phone ?? '', email, MANUAL_BATCH],
    )
    res.status(201).json(mapInvitee(result.rows[0]))
  }),
)

// Bulk add from a CSV the frontend already parsed into rows.
inviteesRouter.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const rows: Array<{ name?: string; phone?: string; email?: string }> = req.body?.rows ?? []
    // The CSV's filename, so each import stays identifiable in the console.
    // Falls back to a timestamp when the browser gave us no name.
    const rawBatch = typeof req.body?.batch === 'string' ? req.body.batch.trim() : ''
    const batch = (rawBatch || `Import ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`).slice(0, 120)
    const added: ReturnType<typeof mapInvitee>[] = []
    const skipped: Array<{ email?: string; reason: string }> = []
    for (const row of rows) {
      if (!row.name || !row.email) {
        skipped.push({ email: row.email, reason: 'missing name or email' })
        continue
      }
      const dup = await query('SELECT 1 FROM invitees WHERE lower(email) = lower($1)', [row.email])
      if (dup.rowCount) {
        skipped.push({ email: row.email, reason: 'duplicate email' })
        continue
      }
      const result = await query<InviteeRow>(
        `INSERT INTO invitees (name, phone, email, batch_label) VALUES ($1, $2, $3, $4)
         RETURNING ${INVITEE_COLS}`,
        [row.name, row.phone ?? '', row.email, batch],
      )
      added.push(mapInvitee(result.rows[0]))
    }
    res.status(201).json({ added, skipped, batch })
  }),
)


// GET /api/alumni/:id/invite-email — the invite this person was sent.
//
// Prefers the copy stored at send time (invite_sent_body), so what's shown is
// what actually went out even if the template has been edited since. Falls
// back to rendering the CURRENT template for rows sent before that copy was
// kept — flagged with exact:false so the console can say which it is.
//
// The password is redacted in both cases: it is bcrypt'd at account creation
// and never stored in readable form, so it cannot be shown back. Resending is
// the remedy for a lost invite, not retrieval.
inviteesRouter.get(
  '/:id/invite-email',
  asyncHandler(async (req, res) => {
    const row = await query<{
      name: string
      email: string
      invited_at: Date | null
      invite_status: string | null
      invite_error: string | null
      invite_count: number
      invite_sent_subject: string | null
      invite_sent_body: string | null
    }>(
      `SELECT name, email, invited_at, invite_status, invite_error, invite_count,
              invite_sent_subject, invite_sent_body
         FROM invitees WHERE id = $1`,
      [req.params.id],
    )
    if (!row.rowCount) throw new ApiError(404, 'No such invitee')
    const i = row.rows[0]

    let subject = i.invite_sent_subject
    let body = i.invite_sent_body
    const exact = !!body

    if (!exact) {
      const tpl = await query<{ subject: string; body: string }>(
        `SELECT subject, body FROM email_templates WHERE key = $1`,
        [INVITE_TEMPLATE_KEY],
      )
      const vars = {
        name: i.name,
        email: i.email,
        password: PASSWORD_REDACTED,
        link: inviteLinkFor(i.email),
      }
      subject = renderTemplate(tpl.rows[0]?.subject ?? INVITE_DEFAULT_SUBJECT, vars)
      body = renderTemplate(tpl.rows[0]?.body ?? INVITE_DEFAULT_BODY, vars)
    }

    res.json({
      name: i.name,
      email: i.email,
      subject,
      body,
      // false = reconstructed from the current template, not the sent bytes.
      exact,
      invitedAt: i.invited_at ? new Date(i.invited_at).toISOString() : null,
      inviteStatus: i.invite_status ?? (i.invited_at ? 'sent' : null),
      inviteError: i.invite_error,
      inviteCount: i.invite_count ?? 0,
      inviteLink: inviteLinkFor(i.email),
      passwordRedacted: PASSWORD_REDACTED,
    })
  }),
)
