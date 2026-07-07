import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { mapUser, type UserRow } from '../mappers.js'

export const usersRouter = Router()

const USER_COLS = `id, name, email, phone, avatar, batch_year, course, company, designation,
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
