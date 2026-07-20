import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { mapUser, type UserRow } from '../mappers.js'

export const usersRouter = Router()

const USER_COLS = `id, name, email, phone, photo, profile_tag, email_verified_at, email_digest, avatar, batch_year, course, company, designation,
  experience_years, domain, employment_type, city, bio, linkedin, expertise,
  willing_to_mentor, interested_in_startup, connections_count, is_mentor,
  mentor_rate, sessions_conducted, is_admin`

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
