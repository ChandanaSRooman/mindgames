import nodemailer from 'nodemailer'

// SMTP is configured via env (.env): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
// If unset, email sending is simulated so the app still works out of the box.
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env

export const emailEnabled = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)

const transport = emailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465, // implicit TLS only on 465
      auth: { user: SMTP_USER!, pass: SMTP_PASS! },
    })
  : null

// Where the deployed frontend lives; set APP_URL in .env (e.g. http://44.249.86.223).
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

const INVITE_SUBJECT = "You're invited to the Rooman Alumni Network"
const inviteBody = (name: string) =>
  `Hi ${name},\n\nYou've been invited to join the Rooman Alumni Network — paid mentorship, ` +
  `StartupVarsity incubation support, and a trusted community of alumni.\n\n` +
  `Accept your invitation: ${APP_URL}/accept-invite\n\n— The Rooman Team`

/**
 * Send invite emails. Returns the count actually sent (or simulated).
 * Failures per-recipient are logged but don't abort the batch.
 */
export async function sendInviteEmails(
  recipients: Array<{ name: string; email: string }>,
): Promise<number> {
  if (!transport) return recipients.length // simulated
  let sent = 0
  for (const r of recipients) {
    try {
      await transport.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: r.email,
        subject: INVITE_SUBJECT,
        text: inviteBody(r.name),
      })
      sent++
    } catch (err) {
      console.error(`Email to ${r.email} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return sent
}
