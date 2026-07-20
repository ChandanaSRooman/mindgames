import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { optionalAuth, requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'

export const startupsRouter = Router()

interface StartupRow {
  id: string
  founder_id: string
  name: string
  domain: string
  stage: string
  team_size: number
  description: string
  visibility: string
}

function mapStartup(r: StartupRow) {
  return {
    id: r.id,
    founderId: r.founder_id,
    name: r.name,
    domain: r.domain,
    stage: r.stage,
    teamSize: r.team_size,
    description: r.description,
    visibility: r.visibility,
  }
}

// GET /api/startups — network-visible listings, newest first. Admin-only
// (confidential) ideas are shown only to their founder here; admins review
// them via /applications.
startupsRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.sub ?? null
    const result = await query<StartupRow>(
      `SELECT id, founder_id, name, domain, stage, team_size, description, visibility
       FROM startups
       WHERE visibility = 'network' OR founder_id = $1
       ORDER BY created_at DESC`,
      [uid],
    )
    res.json(result.rows.map(mapStartup))
  }),
)

// GET /api/startups/applications — admin review list: every application with
// the founder's contact details so the StartupVarsity team can follow up.
startupsRouter.get(
  '/applications',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await query<
      StartupRow & { founder_name: string; founder_email: string; founder_phone: string | null; created_at: Date }
    >(
      `SELECT s.id, s.founder_id, s.name, s.domain, s.stage, s.team_size, s.description, s.visibility, s.created_at,
              u.name AS founder_name, u.email AS founder_email, u.phone AS founder_phone
       FROM startups s JOIN users u ON u.id = s.founder_id
       ORDER BY s.created_at DESC`,
    )
    res.json(
      result.rows.map((r) => ({
        ...mapStartup(r),
        founderName: r.founder_name,
        founderEmail: r.founder_email,
        founderPhone: r.founder_phone ?? undefined,
        appliedAt: new Date(r.created_at).toISOString(),
      })),
    )
  }),
)

const createSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  domain: z.string().trim().min(1, 'domain is required'),
  stage: z.enum(['Idea', 'MVP', 'Early Revenue', 'Scaling']).default('Idea'),
  teamSize: z.number().int().min(1).default(1),
  description: z.string().trim().default(''),
  // 'network' = everyone can see it; 'admin' = confidential application.
  visibility: z.enum(['network', 'admin']).default('network'),
})

// POST /api/startups — submit a StartupVarsity application.
startupsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const s = parsed.data

    const result = await query<StartupRow>(
      `INSERT INTO startups (founder_id, name, domain, stage, team_size, description, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, founder_id, name, domain, stage, team_size, description, visibility`,
      [req.user!.sub, s.name, s.domain, s.stage, s.teamSize, s.description, s.visibility],
    )

    // Let the Rooman admins know a new incubation application arrived.
    const founder = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
    const admins = await query<{ id: string }>(`SELECT id FROM users WHERE is_admin AND id <> $1`, [req.user!.sub])
    for (const a of admins.rows) {
      void pushNotification(
        a.id,
        'community',
        `New StartupVarsity application: "${s.name}" (${s.stage}, ${s.domain}) by ${founder.rows[0].name}.`,
        req.user!.sub,
      )
    }

    res.status(201).json(mapStartup(result.rows[0]))
  }),
)
