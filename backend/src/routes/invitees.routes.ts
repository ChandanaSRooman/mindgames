import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { asyncHandler, ApiError } from '../http.js'
import { mapInvitee, type InviteeRow } from '../mappers.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'

// Admin "alumni directory" — contacts to invite. Kept under /api/alumni so the
// existing Admin UI (AdminDashboard, AlumniTable) works unchanged.
// Admin-only: sign in as the official account (network@rooman.com).
export const inviteesRouter = Router()
inviteesRouter.use(requireAuth, requireAdmin)

const INVITEE_COLS = `id, name, phone, email, role, batch_year, status_tags`

inviteesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await query<InviteeRow>(
      `SELECT ${INVITEE_COLS} FROM invitees ORDER BY created_at`,
    )
    res.json(result.rows.map(mapInvitee))
  }),
)

const addSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().email('valid email is required'),
  phone: z.string().optional(),
})

inviteesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = addSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { name, email, phone } = parsed.data

    const dup = await query('SELECT 1 FROM invitees WHERE lower(email) = lower($1)', [email])
    if (dup.rowCount) throw new ApiError(409, 'An alumnus with this email already exists')

    const result = await query<InviteeRow>(
      `INSERT INTO invitees (name, phone, email) VALUES ($1, $2, $3) RETURNING ${INVITEE_COLS}`,
      [name, phone ?? '', email],
    )
    res.status(201).json(mapInvitee(result.rows[0]))
  }),
)

// Bulk add from a CSV the frontend already parsed into rows.
inviteesRouter.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const rows: Array<{ name?: string; phone?: string; email?: string }> = req.body?.rows ?? []
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
        `INSERT INTO invitees (name, phone, email) VALUES ($1, $2, $3) RETURNING ${INVITEE_COLS}`,
        [row.name, row.phone ?? '', row.email],
      )
      added.push(mapInvitee(result.rows[0]))
    }
    res.status(201).json({ added, skipped })
  }),
)
