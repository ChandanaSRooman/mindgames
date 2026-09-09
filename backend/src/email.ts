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
      // Fail fast if the mail server is slow/unreachable rather than hanging the
      // caller (callers still shouldn't await sends on the request path).
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null

// Where the deployed frontend lives; set APP_URL in .env (e.g. http://44.249.86.223).
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// The invite email's default copy. The account already exists by the time
// this is sent (see invites.routes.ts) — this carries the one-time
// credentials for it, not just a nudge to go sign up. The password is shown
// once, in the clear, because there is no other channel to hand it over; the
// recipient can change it any time from Settings once signed in.
//
// Admins can override subject and body from the console (email_templates
// table). Both forms run through renderTemplate, so the default text is
// written with the same {{placeholders}} a custom one uses — that keeps the
// editor's "reset to default" honest instead of showing different copy from
// what actually goes out.
export const INVITE_TEMPLATE_KEY = 'invite'

export const INVITE_DEFAULT_SUBJECT = "You're invited to the Rooman Alumni Network"

export const INVITE_DEFAULT_BODY = [
  'Hi {{name}},',
  '',
  "You've been invited to join the Rooman Alumni Network — paid mentorship, StartupVarsity " +
    'incubation support, and a trusted community of alumni. An account has already been ' +
    'created for you:',
  '',
  '  Email:    {{email}}',
  '  Password: {{password}}',
  '',
  'Sign in here: {{link}}',
  '',
  "You can change this password any time from Settings once you're signed in — there's no " +
    'need to keep using this one. Your email address is your account identity and ' +
    "can't be changed from Settings; contact your administrator if it ever needs to change.",
  '',
  '— The Rooman Team',
].join('\n')

/** Placeholders the invite template understands, for the admin editor's legend. */
export const INVITE_PLACEHOLDERS = ['name', 'email', 'password', 'link'] as const

/** Placeholders an invite is useless without — the editor refuses to drop these. */
export const INVITE_REQUIRED_PLACEHOLDERS = ['password', 'link'] as const

/**
 * The sign-in URL for an invited member. ?email= pre-fills (and locks) the
 * address on the sign-in screen, so the only thing they have to copy across
 * from the email is the password.
 */
export const inviteLinkFor = (email: string) => `${APP_URL}/login?email=${encodeURIComponent(email)}`

/** Substitutes {{name}}-style placeholders. Unknown ones are left untouched. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole,
  )
}

export interface EmailTemplate {
  subject: string
  body: string
}

/** What happened to one recipient's invite — recorded per invitee so the
 *  admin console can show who actually got their credentials. */
export interface InviteSendResult {
  email: string
  status: 'sent' | 'failed' | 'simulated'
  error?: string
}

/**
 * Send invite emails carrying the auto-generated login credentials for an
 * account created at invite time. Returns one result per recipient — a
 * failure is reported, not thrown, so one bad address can't abort the batch.
 *
 * `template` overrides the default copy (the admin-edited version); omitted,
 * the built-in default is used.
 */
export async function sendInviteEmails(
  recipients: Array<{ name: string; email: string; password: string }>,
  template?: EmailTemplate,
): Promise<InviteSendResult[]> {
  const subject = template?.subject || INVITE_DEFAULT_SUBJECT
  const body = template?.body || INVITE_DEFAULT_BODY

  const render = (r: { name: string; email: string; password: string }) => ({
    subject: renderTemplate(subject, {
      name: r.name,
      email: r.email,
      password: r.password,
      link: inviteLinkFor(r.email),
    }),
    text: renderTemplate(body, {
      name: r.name,
      email: r.email,
      password: r.password,
      link: inviteLinkFor(r.email),
    }),
  })

  if (!transport) {
    // Simulated: log the whole thing, so a dev without SMTP can still read the
    // generated password and click through the flow.
    return recipients.map((r) => {
      const { subject: s, text } = render(r)
      console.log(`[email simulated] to=${r.email} subject="${s}"\n${text}`)
      return { email: r.email, status: 'simulated' as const }
    })
  }

  const results: InviteSendResult[] = []
  for (const r of recipients) {
    try {
      const { subject: s, text } = render(r)
      await transport.sendMail({ from: SMTP_FROM || SMTP_USER, to: r.email, subject: s, text })
      results.push({ email: r.email, status: 'sent' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Email to ${r.email} failed:`, message)
      results.push({ email: r.email, status: 'failed', error: message.slice(0, 500) })
    }
  }
  return results
}

/**
 * Generic single-recipient sender. Returns true when a real email went out,
 * false when SMTP is unconfigured (the message is logged instead so dev
 * environments keep working).
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!transport) {
    console.log(`[email simulated] to=${to} subject="${subject}"\n${text}`)
    return false
  }
  await transport.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text })
  return true
}

export function sendPasswordResetEmail(to: string, name: string, link: string): Promise<boolean> {
  return sendEmail(
    to,
    'Reset your Root Connect password',
    `Hi ${name},\n\nSomeone requested a password reset for your Root Connect account. ` +
      `If this was you, set a new password here (link valid for 1 hour):\n\n${link}\n\n` +
      `If you didn't request this, you can safely ignore this email.\n\n— The Rooman Team`,
  )
}

export function sendVerificationEmail(to: string, name: string, link: string): Promise<boolean> {
  return sendEmail(
    to,
    'Verify your email for Root Connect',
    `Hi ${name},\n\nWelcome to the Rooman Alumni Network! Please confirm this email address ` +
      `so we know it's really you:\n\n${link}\n\n— The Rooman Team`,
  )
}

// Where an email-change request lands. No dedicated request queue exists
// (see users.routes.ts) — the admin account is the destination, same as
// every other admin-only action in this app.
const ADMIN_CONTACT_EMAIL = process.env.ADMIN_EMAIL || 'admin@rooman.com'

export function sendEmailChangeRequestEmail(
  userId: string,
  name: string,
  currentEmail: string,
  requestedEmail: string,
  reason: string,
): Promise<boolean> {
  return sendEmail(
    ADMIN_CONTACT_EMAIL,
    `Email change request — ${name}`,
    `${name} (user id ${userId}) has asked to change their sign-in email.\n\n` +
      `  Current email:   ${currentEmail}\n` +
      `  Requested email: ${requestedEmail}\n` +
      `  Reason given:    ${reason || '(none given)'}\n\n` +
      `Update it directly on the users table if you approve — there is no self-serve ` +
      `email change in the app.`,
  )
}

export const appUrl = APP_URL
