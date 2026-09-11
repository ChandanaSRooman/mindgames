import { Router } from 'express'
import { query } from '../db/pool.js'
import { ApiError, asyncHandler } from '../http.js'
import { sendInviteEmails, emailEnabled, originOf, INVITE_TEMPLATE_KEY, type EmailTemplate } from '../email.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { generatePassword, hashPassword } from '../auth/password.js'
import { USER_COLS, type UserRow } from '../mappers.js'

/** Upper bound on one send, so the request finishes inside a proxy timeout. */
const MAX_BATCH = 100

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
    // Sending is serial (bcrypt, then SMTP paced at 5/sec) and happens on the
    // request path, so a large batch would outlive a proxy's idle timeout and
    // leave the admin with no idea what got through. Cap it and let them send
    // in passes — the filters make that straightforward.
    if (invites.length > MAX_BATCH) {
      throw new ApiError(
        400,
        `That's ${invites.length} recipients — send at most ${MAX_BATCH} at a time so the batch ` +
          `completes before the request times out.`,
      )
    }
    const emailIds = invites.filter((i) => i.email).map((i) => i.id)
    const whatsappCount = invites.filter((i) => i.whatsapp).length

    let recipients: Array<{ name: string; email: string; password: string }> = []
    let alreadyJoined = 0
    let created = 0
    let reissued = 0
    // email → invitee id, so each send result can be written back to its row.
    const idByEmail = new Map<string, string>()
    if (emailIds.length) {
      const rows = await query<{ id: string; name: string; email: string }>(
        `SELECT id, name, email FROM invitees WHERE id = ANY($1)`,
        [emailIds],
      )

      for (const invitee of rows.rows) {
        const existing = await query<{
          id: string
          last_login_at: Date | null
          must_change_password: boolean
        }>(
          `SELECT id, last_login_at, must_change_password FROM users
            WHERE lower(email) = lower($1)`,
          [invitee.email],
        )
        const account = existing.rows[0]

        if (account) {
          // Re-inviting someone who has USED their account would replace a
          // password they rely on — refuse that. But an account that has never
          // been signed into and is still on the password we generated has
          // nothing to lose, and re-issuing is the only way to help someone
          // who never received (or lost) their invite: we can't resend the
          // original, because it was never stored in readable form.
          const untouched = !account.last_login_at && account.must_change_password
          if (!untouched) {
            alreadyJoined++
            continue
          }
          const password = generatePassword()
          await query(
            `UPDATE users SET password_hash = $2, must_change_password = TRUE, updated_at = now()
              WHERE id = $1`,
            [account.id, await hashPassword(password)],
          )
          idByEmail.set(invitee.email.toLowerCase(), invitee.id)
          recipients.push({ name: invitee.name, email: invitee.email, password })
          reissued++
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
        created++
      }
    }

    // Admin-edited copy, if any — no row means the built-in default.
    const tpl = await query<EmailTemplate>(
      `SELECT subject, body FROM email_templates WHERE key = $1`,
      [INVITE_TEMPLATE_KEY],
    )
    // Record each outcome as it happens rather than after the loop: the
    // accounts already exist by then, and their generated passwords only
    // survive inside the emails just sent, so losing the delivery record to a
    // mid-batch failure is unrecoverable.
    // Build the sign-in link from the address this admin reached the console
    // on, so a stale APP_URL can't send everyone a dead link (see originOf).
    const baseUrl = originOf(req)
    const results = await sendInviteEmails(recipients, tpl.rows[0], async (r) => {
      const id = idByEmail.get(r.email.toLowerCase())
      if (!id) return
      await query(
        `UPDATE invitees
            SET invited_at = now(),
                invite_status = $2,
                invite_error = $3,
                invite_count = invite_count + 1,
                invite_sent_subject = $4,
                invite_sent_body = $5
          WHERE id = $1`,
        [id, r.status, r.error ?? null, r.sentSubject, r.sentBody],
      )
    }, baseUrl)

    const failed = results.filter((r) => r.status === 'failed')
    const emailCount = results.filter((r) => r.status !== 'failed').length
    const via = emailEnabled ? 'email' : 'email (simulated)'
    const skippedNote = alreadyJoined
      ? ` ${alreadyJoined} skipped — they've already signed in or set their own password.`
      : ''
    const failedNote = failed.length ? ` ${failed.length} email(s) could not be delivered.` : ''
    const parts = [
      created ? `Created ${created} account(s)` : '',
      reissued ? `re-issued ${reissued} password(s)` : '',
      `sent ${emailCount} ${via} invitation(s)`,
      whatsappCount ? `${whatsappCount} WhatsApp (simulated)` : '',
    ].filter(Boolean)
    res.json({
      emailCount,
      whatsappCount,
      total: emailCount + whatsappCount,
      // Kept for compatibility: total emails prepared, new or re-issued.
      accountsCreated: recipients.length,
      created,
      reissued,
      alreadyJoined,
      failedCount: failed.length,
      results,
      message: `${parts.join(', ')}.${skippedNote}${failedNote}`,
    })
  }),
)
