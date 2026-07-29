import { Router } from 'express'
import { z } from 'zod'
import { createHash, randomInt } from 'node:crypto'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { mapUser, USER_COLS, type UserRow } from '../mappers.js'
import { sendEmail } from '../email.js'

export const usersRouter = Router()

// Personal / free / disposable mail providers — not accepted as a "work" email,
// because they don't prove the person works at a company. Extend as needed.
const NON_WORK_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'yandex.com', 'zoho.com',
  'rediffmail.com', 'inbox.com', 'pm.me',
  // disposable / throwaway
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'sharklasers.com', 'maildrop.cc', 'getnada.com', 'trashmail.com', 'dispostable.com',
  'fakeinbox.com', 'throwawaymail.com', 'mintemail.com',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  const shown = local.length <= 2 ? local[0] ?? '' : `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
  return `${shown}@${domain}`
}

// GET /api/users — the whole directory (drives People You May Know, mentions…).
usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await query<UserRow>(`SELECT ${USER_COLS} FROM users ORDER BY name`)
    res.json(result.rows.map(mapUser))
  }),
)

// GET /api/users/leaderboard — top contributors by activity points.
usersRouter.get(
  '/leaderboard',
  asyncHandler(async (_req, res) => {
    const rows = await query<{ id: string; name: string; photo: string | null; designation: string; points: number }>(
      `SELECT u.id, u.name, u.photo, u.designation,
              ((SELECT count(*)::int FROM posts p WHERE p.author_id = u.id) * 10 +
               (SELECT count(*)::int FROM comments c WHERE c.author_id = u.id) * 2 +
               (SELECT COALESCE(sum(p.likes), 0)::int FROM posts p WHERE p.author_id = u.id) * 3 +
               u.connections_count * 5 +
               COALESCE(u.sessions_conducted, 0) * 25 +
               (SELECT count(*)::int FROM posts p WHERE p.author_id = u.id AND p.type = 'Hiring') * 15 +
               (SELECT count(*)::int FROM communities c WHERE c.created_by = u.id) * 20 +
               (SELECT count(*)::int FROM startups s WHERE s.founder_id = u.id) * 30 +
               (SELECT count(*)::int FROM events e WHERE e.creator_id = u.id) * 15 +
               (CASE WHEN u.email_verified_at IS NOT NULL THEN 20 ELSE 0 END)) AS points
       FROM users u
       WHERE NOT u.is_admin
       ORDER BY points DESC, u.created_at
       LIMIT 5`,
    )
    res.json(rows.rows.map((r) => ({ ...r, photo: r.photo ?? undefined })))
  }),
)

// GET /api/users/:id — a single profile.
usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [
      req.params.id,
    ])
    if (!result.rowCount) throw new ApiError(404, 'User not found')
    res.json(mapUser(result.rows[0]))
  }),
)

// Editable profile fields → their DB columns.
const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  photo: 'photo',
  profileTag: 'profile_tag',
  emailDigest: 'email_digest',
  avatar: 'avatar',
  batchYear: 'batch_year',
  course: 'course',
  company: 'company',
  designation: 'designation',
  college: 'college',
  experienceYears: 'experience_years',
  domain: 'domain',
  employmentType: 'employment_type',
  city: 'city',
  bio: 'bio',
  linkedin: 'linkedin',
  expertise: 'expertise',
  willingToMentor: 'willing_to_mentor',
  interestedInStartup: 'interested_in_startup',
  isMentor: 'is_mentor',
  mentorRate: 'mentor_rate',
  sessionsConducted: 'sessions_conducted',
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().optional(),
    // Small data-URL image; null removes the photo.
    photo: z
      .union([z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(400_000), z.null()])
      .optional(),
    profileTag: z.union([z.enum(['Mentor', 'Hiring', 'Open to Work']), z.null()]).optional(),
    emailDigest: z.boolean().optional(),
    avatar: z.string().optional(),
    batchYear: z.number().int().optional(),
    course: z.string().optional(),
    company: z.string().optional(),
    designation: z.string().optional(),
    college: z.string().optional(),
    experienceYears: z.number().int().min(0).optional(),
    domain: z.string().optional(),
    employmentType: z.string().optional(),
    city: z.string().optional(),
    bio: z.string().optional(),
    linkedin: z.string().optional(),
    expertise: z.array(z.string()).optional(),
    willingToMentor: z.boolean().optional(),
    interestedInStartup: z.boolean().optional(),
    isMentor: z.boolean().optional(),
    mentorRate: z.number().int().optional(),
    sessionsConducted: z.number().int().optional(),
  })
  .strip()

// PATCH /api/users/me — update the authenticated user's own profile.
usersRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)

    const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    if (entries.length === 0) throw new ApiError(400, 'No fields to update')

    const sets: string[] = []
    const values: unknown[] = []
    entries.forEach(([key, value], i) => {
      sets.push(`${COLUMN_MAP[key]} = $${i + 1}`)
      values.push(value)
    })
    values.push(req.user!.sub)

    const result = await query<UserRow>(
      `UPDATE users SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING ${USER_COLS}`,
      values,
    )
    res.json(mapUser(result.rows[0]))
  }),
)


// --- Employer (work-email) verification ------------------------------------
// A user proves they work at a company by verifying a work email with a
// one-time 6-digit code. Once verified they may create Hiring/job posts.

const startSchema = z.object({ email: z.string().trim().max(200) })

// POST /api/users/me/work-email/start — email a 6-digit verification code.
usersRouter.post(
  '/me/work-email/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = startSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, 'A valid work email is required')
    const email = parsed.data.email.toLowerCase()
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'That does not look like a valid email address')
    const domain = email.split('@')[1]
    if (NON_WORK_DOMAINS.has(domain)) {
      throw new ApiError(400, 'Please use your company/work email — personal or temporary email addresses are not accepted.')
    }

    const me = req.user!.sub
    // Rate-limit: one code per minute.
    const existing = await query<{ sent_at: Date }>(
      `SELECT sent_at FROM work_email_otps WHERE user_id = $1`,
      [me],
    )
    if (existing.rowCount && Date.now() - new Date(existing.rows[0].sent_at).getTime() < 60_000) {
      throw new ApiError(429, 'Please wait a minute before requesting another code.')
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await query(
      `INSERT INTO work_email_otps (user_id, email, code_hash, expires_at, attempts, sent_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes', 0, now())
       ON CONFLICT (user_id) DO UPDATE
         SET email = EXCLUDED.email, code_hash = EXCLUDED.code_hash,
             expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()`,
      [me, email, sha256(code)],
    )

    const sent = await sendEmail(
      email,
      'Your RooConnect employer verification code',
      `Your RooConnect verification code is ${code}\n\n` +
        `Enter it on the Jobs page to verify that you work at ${domain} and unlock job posting. ` +
        `The code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.\n\n— The Rooman Team`,
    )
    res.json({ ok: true, email: maskEmail(email), simulated: !sent })
  }),
)

const verifySchema = z.object({ code: z.string().trim() })

// POST /api/users/me/work-email/verify — confirm the code, mark the user a
// verified employer, and return the updated profile.
usersRouter.post(
  '/me/work-email/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, 'Enter the 6-digit code')
    const me = req.user!.sub

    const otp = await query<{ email: string; code_hash: string; expires_at: Date; attempts: number }>(
      `SELECT email, code_hash, expires_at, attempts FROM work_email_otps WHERE user_id = $1`,
      [me],
    )
    if (!otp.rowCount) throw new ApiError(400, 'Request a verification code first.')
    const row = otp.rows[0]

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await query(`DELETE FROM work_email_otps WHERE user_id = $1`, [me])
      throw new ApiError(400, 'That code has expired — request a new one.')
    }
    if (row.attempts >= 5) {
      await query(`DELETE FROM work_email_otps WHERE user_id = $1`, [me])
      throw new ApiError(429, 'Too many incorrect attempts — request a new code.')
    }
    if (sha256(parsed.data.code) !== row.code_hash) {
      await query(`UPDATE work_email_otps SET attempts = attempts + 1 WHERE user_id = $1`, [me])
      throw new ApiError(400, 'Incorrect code. Please check and try again.')
    }

    const domain = row.email.split('@')[1]
    const updated = await query<UserRow>(
      `UPDATE users SET work_email = $2, work_email_domain = $3, work_verified_at = now(), updated_at = now()
       WHERE id = $1 RETURNING ${USER_COLS}`,
      [me, row.email, domain],
    )
    await query(`DELETE FROM work_email_otps WHERE user_id = $1`, [me])
    res.json(mapUser(updated.rows[0]))
  }),
)

// GET /api/users/:id/badges — achievements computed live from activity.
// No stored state: cheap at this network's scale and always accurate.
usersRouter.get(
  '/:id/badges',
  asyncHandler(async (req, res) => {
    const uid = req.params.id
    const user = await query<{
      connections_count: number
      is_mentor: boolean
      sessions_conducted: number | null
      email_verified_at: Date | null
      created_at: Date
    }>(
      `SELECT connections_count, is_mentor, sessions_conducted, email_verified_at, created_at
       FROM users WHERE id = $1`,
      [uid],
    )
    if (!user.rowCount) throw new ApiError(404, 'User not found')
    const u = user.rows[0]

    const stats = await query<{
      posts: number
      comments: number
      jobs: number
      communities: number
      startups: number
      events: number
      likes_received: number
    }>(
      `SELECT
         (SELECT count(*)::int FROM posts WHERE author_id = $1) AS posts,
         (SELECT count(*)::int FROM comments WHERE author_id = $1) AS comments,
         (SELECT count(*)::int FROM posts WHERE author_id = $1 AND type = 'Hiring') AS jobs,
         (SELECT count(*)::int FROM communities WHERE created_by = $1) AS communities,
         (SELECT count(*)::int FROM startups WHERE founder_id = $1) AS startups,
         (SELECT count(*)::int FROM events WHERE creator_id = $1) AS events,
         (SELECT COALESCE(sum(p.likes), 0)::int FROM posts p WHERE p.author_id = $1) AS likes_received`,
      [uid],
    )
    const c = stats.rows[0]
    const sessions = u.sessions_conducted ?? 0

    const badges = [
      { id: 'verified', emoji: '✅', label: 'Verified', description: 'Confirmed their email address', earned: !!u.email_verified_at },
      { id: 'first-post', emoji: '📝', label: 'First Post', description: 'Shared their first post with the network', earned: c.posts >= 1 },
      { id: 'contributor', emoji: '✍️', label: 'Contributor', description: 'Shared 5 or more posts', earned: c.posts >= 5 },
      { id: 'popular', emoji: '❤️', label: 'Crowd Favourite', description: 'Collected 10+ likes on their posts', earned: c.likes_received >= 10 },
      { id: 'connector', emoji: '🤝', label: 'Connector', description: 'Made 5 or more connections', earned: u.connections_count >= 5 },
      { id: 'super-connector', emoji: '🌐', label: 'Super Connector', description: 'Made 20 or more connections', earned: u.connections_count >= 20 },
      { id: 'mentor', emoji: '🎓', label: 'Mentor', description: 'Gives back as a mentor', earned: u.is_mentor || sessions > 0 },
      { id: 'super-mentor', emoji: '🏆', label: 'Super Mentor', description: 'Completed 5+ mentorship sessions', earned: sessions >= 5 },
      { id: 'job-creator', emoji: '💼', label: 'Job Creator', description: 'Posted an opening for fellow alumni', earned: c.jobs >= 1 },
      { id: 'community-builder', emoji: '🏗️', label: 'Community Builder', description: 'Started a community', earned: c.communities >= 1 },
      { id: 'founder', emoji: '🚀', label: 'Founder', description: 'Applied to StartupVarsity with an idea', earned: c.startups >= 1 },
      { id: 'event-host', emoji: '📅', label: 'Event Host', description: 'Hosted a network event', earned: c.events >= 1 },
    ]

    const points =
      c.posts * 10 +
      c.comments * 2 +
      c.likes_received * 3 +
      u.connections_count * 5 +
      sessions * 25 +
      c.jobs * 15 +
      c.communities * 20 +
      c.startups * 30 +
      c.events * 15 +
      (u.email_verified_at ? 20 : 0)

    res.json({ points, badges })
  }),
)
