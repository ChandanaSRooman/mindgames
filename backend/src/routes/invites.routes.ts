import { Router } from 'express'
import { query } from '../db/pool.js'
import { asyncHandler } from '../http.js'
import { sendInviteEmails, emailEnabled, INVITE_TEMPLATE_KEY, type EmailTemplate } from '../email.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { generatePassword, hashPassword } from '../auth/password.js'
import { USER_COLS, type UserRow } from '../mappers.js'

export const invitesRouter = Router()
invitesRouter.use(requireAuth, requireAdmin)

// POST /api/invites/batch — the only way a real member account gets created:
// signup is invite-only (see auth.routes.ts), so sending the email invite IS
// account creation. For each invitee checked for email, we generate a
// password, create their `users` row right here (if one doesn't already
// exist for that email), and mail them the credentials. WhatsApp delivery is
// still simulated — there's no channel to hand a password over that way, so
// it stays a contact nudge rather than an account trigger.
// Marks invited_at on the invitees that were processed.
invitesRouter.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const invites: Array<{ id: string; email?: boolean; whatsapp?: boolean }> = req.body?.invites ?? []
    const emailIds = invites.filter((i) => i.email).map((i) => i.id)
    const whatsappCount = invites.filter((i) => i.whatsapp).length

    let recipients: Array<{ name: string; email: string; password: string }> = []
    let alreadyJoined = 0
    // email → invitee id, so each send result can be written back to its row.
    const idByEmail = new Map<string, string>()
    if (emailIds.length) {
      const rows = await query<{ id: string; name: string; email: string }>(
        `SELECT id, name, email FROM invitees WHERE id = ANY($1)`,
        [emailIds],
      )

      for (const invitee of rows.rows) {
        const existing = await query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [invitee.email])
        if (existing.rowCount) {
          // Already has an account (e.g. re-invited, or a seeded/demo user)
          // — never overwrite a password someone may already be using.
          alreadyJoined++
          continue
        }
        idByEmail.set(invitee.email.toLowerCase(), invitee.id)
        const password = generatePassword()
        const passwordHash = await hashPassword(password)
        await query<UserRow & { is_admin: boolean }>(
          `INSERT INTO users (name, email, password_hash, avatar, batch_year, email_verified_at,
                              must_change_password)
           VALUES ($1, $2, $3, $1, date_part('year', now()), now(), TRUE)
           RETURNING ${USER_COLS}`,
          [invitee.name, invitee.email, passwordHash],
        )
        recipients.push({ name: invitee.name, email: invitee.email, password })
      }
    }

    // Admin-edited copy, if any — no row means the built-in default.
    const tpl = await query<EmailTemplate>(
      `SELECT subject, body FROM email_templates WHERE key = $1`,
      [INVITE_TEMPLATE_KEY],
    )
    const results = await sendInviteEmails(recipients, tpl.rows[0])

    // Record the outcome on each invitee row, so the console can report who
    // actually received their credentials — and why, when one didn't.
    for (const r of results) {
      const id = idByEmail.get(r.email.toLowerCase())
      if (!id) continue
      await query(
        `UPDATE invitees
            SET invited_at = now(),
                invite_status = $2,
                invite_error = $3,
                invite_count = invite_count + 1
          WHERE id = $1`,
        [id, r.status, r.error ?? null],
      )
    }

    const failed = results.filter((r) => r.status === 'failed')
    const emailCount = results.filter((r) => r.status !== 'failed').length
    const via = emailEnabled ? 'email' : 'email (simulated)'
    const skippedNote = alreadyJoined ? ` ${alreadyJoined} already had an account and were skipped.` : ''
    const failedNote = failed.length ? ` ${failed.length} email(s) could not be delivered.` : ''
    res.json({
      emailCount,
      whatsappCount,
      total: emailCount + whatsappCount,
      accountsCreated: recipients.length,
      alreadyJoined,
      failedCount: failed.length,
      results,
      message:
        `Created ${recipients.length} account(s) and sent ${emailCount} ${via} invitation(s), ` +
        `plus ${whatsappCount} WhatsApp (simulated).${skippedNote}${failedNote}`,
    })
  }),
)
