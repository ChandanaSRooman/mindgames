import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { query } from '../db/pool.js'
import { appUrl, emailEnabled, sendPasswordResetEmail, sendVerificationEmail } from '../email.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { signToken } from '../auth/jwt.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { mapUser, type UserRow } from '../mappers.js'

export const authRouter = Router()

const USER_COLS = `id, name, email, phone, photo, profile_tag, email_verified_at, email_digest, avatar, batch_year, course, company, designation,
  experience_years, domain, employment_type, city, bio, linkedin, expertise,
  willing_to_mentor, interested_in_startup, connections_count, is_mentor,
  mentor_rate, sessions_conducted, is_admin`

const signupSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().email('valid email is required'),
  password: z.string().min(6, 'password must be at least 6 characters'),
})

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

/** Mint a single-use email token (stored hashed) and return the raw value. */
async function createAuthToken(userId: string, purpose: 'reset' | 'verify', ttlMs: number): Promise<string> {
  const raw = randomBytes(32).toString('hex')
  // One live token per (user, purpose) — reissuing invalidates older links.
  await query(`DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2`, [userId, purpose])
  await query(
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [sha256(raw), userId, purpose, new Date(Date.now() + ttlMs)],
  )
  return raw
}

/** Redeem a token: returns the user id and burns it, or null when invalid. */
async function consumeAuthToken(raw: string, purpose: 'reset' | 'verify'): Promise<string | null> {
  const r = await query<{ user_id: string }>(
    `DELETE FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > now()
     RETURNING user_id`,
    [sha256(raw), purpose],
  )
  return r.rows[0]?.user_id ?? null
}

/** Email a verification link; fire-and-forget from signup. */
async function sendVerification(userId: string, name: string, email: string): Promise<string> {
  const raw = await createAuthToken(userId, 'verify', 7 * 24 * 60 * 60 * 1000)
  const link = `${appUrl}/verify-email?token=${raw}`
  void sendVerificationEmail(email, name, link).catch((err) =>
    console.error('verification email failed:', err instanceof Error ? err.message : err),
  )
  return link
}

// Issue a token + return the created/authenticated user.
function issue(userRow: UserRow & { is_admin: boolean }) {
  const token = signToken({ sub: userRow.id, email: userRow.email, isAdmin: userRow.is_admin })
  return { token, user: mapUser(userRow) }
}

// POST /api/auth/signup — create a new alumni account.
authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { name, email, password } = parsed.data

    const exists = await query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email])
    if (exists.rowCount) throw new ApiError(409, 'An account with this email already exists')

    const passwordHash = await hashPassword(password)
    const result = await query<UserRow & { is_admin: boolean }>(
      `INSERT INTO users (name, email, password_hash, avatar, batch_year)
       VALUES ($1, $2, $3, $1, date_part('year', now()))
       RETURNING ${USER_COLS}`,
      [name, email, passwordHash],
    )
    void sendVerification(result.rows[0].id, name, email)
    res.status(201).json(issue(result.rows[0]))
  }),
)

// POST /api/auth/forgot-password — email a reset link. Always answers the
// same way so the endpoint can't be used to probe which emails exist.
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const email = z.string().trim().email().safeParse(req.body?.email)
    if (!email.success) throw new ApiError(400, 'valid email is required')

    const user = await query<{ id: string; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE lower(email) = lower($1) AND password_hash IS NOT NULL`,
      [email.data],
    )
    let devResetLink: string | undefined
    if (user.rowCount) {
      const raw = await createAuthToken(user.rows[0].id, 'reset', 60 * 60 * 1000)
      const link = `${appUrl}/reset-password?token=${raw}`
      await sendPasswordResetEmail(user.rows[0].email, user.rows[0].name, link)
      // SMTP unconfigured (dev/demo): surface the link so the flow stays usable.
      if (!emailEnabled && config.nodeEnv !== 'production') devResetLink = link
    }
    res.json({
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(devResetLink ? { devResetLink } : {}),
    })
  }),
)

// POST /api/auth/reset-password — set a new password with a valid token.
authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({ token: z.string().min(10), password: z.string().min(6, 'password must be at least 6 characters') })
      .safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)

    const userId = await consumeAuthToken(parsed.data.token, 'reset')
    if (!userId) throw new ApiError(400, 'This reset link is invalid or has expired. Request a new one.')

    const passwordHash = await hashPassword(parsed.data.password)
    await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [passwordHash, userId])
    res.json({ ok: true })
  }),
)

// POST /api/auth/verify-email — confirm the address from the emailed link.
authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = z.string().min(10).safeParse(req.body?.token)
    if (!token.success) throw new ApiError(400, 'token is required')
    const userId = await consumeAuthToken(token.data, 'verify')
    if (!userId) throw new ApiError(400, 'This verification link is invalid or has expired.')
    await query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [userId])
    res.json({ ok: true })
  }),
)

// POST /api/auth/resend-verification — signed-in users can ask for a new link.
authRouter.post(
  '/resend-verification',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await query<{ id: string; name: string; email: string; email_verified_at: Date | null }>(
      `SELECT id, name, email, email_verified_at FROM users WHERE id = $1`,
      [req.user!.sub],
    )
    if (!user.rowCount) throw new ApiError(404, 'User not found')
    if (user.rows[0].email_verified_at) return res.json({ ok: true, alreadyVerified: true })
    const link = await sendVerification(user.rows[0].id, user.rows[0].name, user.rows[0].email)
    res.json({
      ok: true,
      ...(!emailEnabled && config.nodeEnv !== 'production' ? { devVerifyLink: link } : {}),
    })
  }),
)

const loginSchema = z.object({
  email: z.string().trim().email('valid email is required'),
  password: z.string().min(1, 'password is required'),
})

// POST /api/auth/login — email + password.
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { email, password } = parsed.data

    const result = await query<UserRow & { is_admin: boolean; password_hash: string | null }>(
      `SELECT ${USER_COLS}, password_hash FROM users WHERE lower(email) = lower($1)`,
      [email],
    )
    const row = result.rows[0]
    if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
      throw new ApiError(401, 'Invalid email or password')
    }
    res.json(issue(row))
  }),
)

// GET /api/auth/config — which social providers are configured for real.
// The frontend uses this to decide between real Google OAuth and the fallback.
authRouter.get('/config', (_req, res) => {
  res.json({ googleClientId: config.googleClientId || null })
})

const googleSchema = z.object({ accessToken: z.string().min(1, 'accessToken is required') })

interface GoogleTokenInfo {
  aud?: string
  email?: string
  email_verified?: string | boolean
  expires_in?: string
}

interface GoogleUserInfo {
  email?: string
  email_verified?: boolean
  name?: string
}

// POST /api/auth/google — real Google sign-in. The frontend obtains an OAuth
// access token via Google Identity Services (popup); we validate it against
// Google (audience must be OUR client id — blocks token-substitution) and
// upsert the account by email.
authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    if (!config.googleClientId) {
      throw new ApiError(501, 'Google sign-in is not configured (set GOOGLE_CLIENT_ID)')
    }
    const parsed = googleSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { accessToken } = parsed.data

    // 1. Validate the token itself and that it was issued to our app.
    const infoRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    )
    if (!infoRes.ok) throw new ApiError(401, 'Invalid Google token')
    const info = (await infoRes.json()) as GoogleTokenInfo
    if (info.aud !== config.googleClientId) throw new ApiError(401, 'Google token audience mismatch')

    // 2. Fetch the verified profile (name + email).
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!profileRes.ok) throw new ApiError(401, 'Could not fetch Google profile')
    const profile = (await profileRes.json()) as GoogleUserInfo
    const email = profile.email
    if (!email) throw new ApiError(401, 'Google account has no email')
    if (profile.email_verified === false) throw new ApiError(401, 'Google email is not verified')
    const name = profile.name || email.split('@')[0]

    // 3. Upsert by email: existing users just sign in; new ones get an account
    //    with no password (they sign in via Google).
    const existing = await query<UserRow & { is_admin: boolean }>(
      `SELECT ${USER_COLS} FROM users WHERE lower(email) = lower($1)`,
      [email],
    )
    if (existing.rowCount) return res.json(issue(existing.rows[0]))

    const created = await query<UserRow & { is_admin: boolean }>(
      `INSERT INTO users (name, email, avatar, batch_year)
       VALUES ($1, $2, $1, date_part('year', now()))
       RETURNING ${USER_COLS}`,
      [name, email],
    )
    res.status(201).json(issue(created.rows[0]))
  }),
)

// POST /api/auth/social/:provider — simulated OAuth fallback. Upserts a stable
// per-provider demo account so the button always logs into the same user.
// Used for LinkedIn, and for Google when GOOGLE_CLIENT_ID isn't set.
authRouter.post(
  '/social/:provider',
  asyncHandler(async (req, res) => {
    const provider = req.params.provider
    if (provider !== 'google' && provider !== 'linkedin') {
      throw new ApiError(400, 'unsupported provider')
    }
    const email = `${provider}.user@rooman.alumni`
    const name = provider === 'google' ? 'Google User' : 'LinkedIn User'
    const result = await query<UserRow & { is_admin: boolean }>(
      `INSERT INTO users (name, email, avatar, batch_year)
       VALUES ($1, $2, $1, date_part('year', now()))
       ON CONFLICT (email) DO UPDATE SET updated_at = now()
       RETURNING ${USER_COLS}`,
      [name, email],
    )
    res.status(201).json(issue(result.rows[0]))
  }),
)

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
})

// POST /api/auth/change-password — set a new password. Accounts with an
// existing password must supply the current one; social-only accounts (no
// password yet) may set one directly — they're already authenticated via JWT.
authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { currentPassword, newPassword } = parsed.data

    const row = await query<{ password_hash: string | null }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user!.sub],
    )
    if (!row.rowCount) throw new ApiError(404, 'User not found')
    const existing = row.rows[0].password_hash
    if (existing) {
      if (!currentPassword || !(await verifyPassword(currentPassword, existing))) {
        throw new ApiError(401, 'Current password is incorrect')
      }
    }
    await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
      await hashPassword(newPassword),
      req.user!.sub,
    ])
    res.json({ ok: true })
  }),
)

// GET /api/auth/me — the current authenticated user.
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [
      req.user!.sub,
    ])
    if (!result.rowCount) throw new ApiError(404, 'User not found')
    res.json({ user: mapUser(result.rows[0]) })
  }),
)
