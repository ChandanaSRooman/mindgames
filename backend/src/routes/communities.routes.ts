import { Router } from 'express'
import { z } from 'zod'
import { query, withTransaction } from '../db/pool.js'
import { optionalAuth, requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'

export const communitiesRouter = Router()

interface CommunityRow {
  id: string
  name: string
  description: string
  category: string
  tag: string
  color: string
  member_count: number
  status: 'pending' | 'approved' | 'rejected'
  created_by: string | null
  joined: boolean
}

const COMMUNITY_SELECT = `
  SELECT c.id, c.name, c.description, c.category, c.tag, c.color, c.member_count,
         c.status, c.created_by,
         EXISTS (SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = $1) AS joined
  FROM communities c`

function mapCommunity(r: CommunityRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    tag: r.tag,
    memberCount: r.member_count,
    joined: r.joined,
    color: r.color,
    status: r.status,
    createdBy: r.created_by ?? undefined,
  }
}

// GET /api/communities — approved communities for everyone, plus the caller's
// own pending/rejected ones (so creators can track their requests).
communitiesRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.sub ?? null
    const result = await query<CommunityRow>(
      `${COMMUNITY_SELECT}
       WHERE c.status = 'approved' OR ($1::text IS NOT NULL AND c.created_by = $1)
       ORDER BY c.member_count DESC`,
      [uid],
    )
    res.json(result.rows.map(mapCommunity))
  }),
)

// GET /api/communities/pending — admin review queue with creator names.
communitiesRouter.get(
  '/pending',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await query<CommunityRow & { creator_name: string }>(
      `${COMMUNITY_SELECT.replace('FROM communities c', ', u.name AS creator_name FROM communities c LEFT JOIN users u ON u.id = c.created_by')}
       WHERE c.status = 'pending' ORDER BY c.created_at`,
      [req.user!.sub],
    )
    res.json(result.rows.map((r) => ({ ...mapCommunity(r), creatorName: r.creator_name ?? 'Unknown' })))
  }),
)

const createSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  description: z.string().trim().default(''),
  category: z.enum(['Domain', 'City', 'Batch', 'General']).default('General'),
  tag: z.string().trim().default(''),
})

// POST /api/communities — request a community. Members' communities await
// admin acceptance ('pending'); admin-created ones go live immediately.
communitiesRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const c = parsed.data
    const status = req.user!.isAdmin ? 'approved' : 'pending'

    const created = await withTransaction(async (client) => {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO communities (name, description, category, tag, member_count, created_by, status)
         VALUES ($1,$2,$3,$4,1,$5,$6) RETURNING id`,
        [c.name, c.description || 'A new Rooman alumni community.', c.category, c.tag || c.name, req.user!.sub, status],
      )
      await client.query(
        `INSERT INTO community_members (community_id, user_id) VALUES ($1,$2)`,
        [ins.rows[0].id, req.user!.sub],
      )
      return ins.rows[0].id
    })

    // Ask the admins to review member-created communities.
    if (status === 'pending') {
      const me = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
      const admins = await query<{ id: string }>(`SELECT id FROM users WHERE is_admin`)
      for (const a of admins.rows) {
        void pushNotification(
          a.id,
          'community',
          `${me.rows[0].name} requested a new community: "${c.name}" (${c.category}).`,
          req.user!.sub,
        )
      }
    }

    const full = await query<CommunityRow>(`${COMMUNITY_SELECT} WHERE c.id = $2`, [req.user!.sub, created])
    res.status(201).json(mapCommunity(full.rows[0]))
  }),
)

// POST /api/communities/:id/approve — admin accepts a pending community.
communitiesRouter.post(
  '/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query<{ name: string; created_by: string | null }>(
      `UPDATE communities SET status = 'approved' WHERE id = $1 AND status = 'pending'
       RETURNING name, created_by`,
      [req.params.id],
    )
    if (!upd.rowCount) throw new ApiError(404, 'No pending community with this id')
    const { name, created_by } = upd.rows[0]
    if (created_by) {
      void pushNotification(
        created_by,
        'community',
        `Your community "${name}" was approved and is now live! 🎉`,
        req.user!.sub,
      )
    }
    res.json({ ok: true })
  }),
)

// POST /api/communities/:id/reject — admin declines a pending community.
communitiesRouter.post(
  '/:id/reject',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query<{ name: string; created_by: string | null }>(
      `UPDATE communities SET status = 'rejected' WHERE id = $1 AND status = 'pending'
       RETURNING name, created_by`,
      [req.params.id],
    )
    if (!upd.rowCount) throw new ApiError(404, 'No pending community with this id')
    const { name, created_by } = upd.rows[0]
    if (created_by) {
      void pushNotification(
        created_by,
        'community',
        `Your community request "${name}" was declined. Reach out to the Rooman team for details.`,
        req.user!.sub,
      )
    }
    res.json({ ok: true })
  }),
)

// POST /api/communities/:id/join — join a live community (idempotent).
communitiesRouter.post(
  '/:id/join',
  requireAuth,
  asyncHandler(async (req, res) => {
    const exists = await query<{ status: string }>(`SELECT status FROM communities WHERE id = $1`, [req.params.id])
    if (!exists.rowCount) throw new ApiError(404, 'Community not found')
    if (exists.rows[0].status !== 'approved') {
      throw new ApiError(400, 'This community is awaiting admin approval')
    }

    await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO community_members (community_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [req.params.id, req.user!.sub],
      )
      if (ins.rowCount) {
        await client.query(`UPDATE communities SET member_count = member_count + 1 WHERE id = $1`, [req.params.id])
      }
    })
    const full = await query<CommunityRow>(`${COMMUNITY_SELECT} WHERE c.id = $2`, [req.user!.sub, req.params.id])
    res.json(mapCommunity(full.rows[0]))
  }),
)

// DELETE /api/communities/:id/join — leave (idempotent).
communitiesRouter.delete(
  '/:id/join',
  requireAuth,
  asyncHandler(async (req, res) => {
    const exists = await query('SELECT 1 FROM communities WHERE id = $1', [req.params.id])
    if (!exists.rowCount) throw new ApiError(404, 'Community not found')

    await withTransaction(async (client) => {
      const del = await client.query(
        `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
        [req.params.id, req.user!.sub],
      )
      if (del.rowCount) {
        await client.query(
          `UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1`,
          [req.params.id],
        )
      }
    })
    const full = await query<CommunityRow>(`${COMMUNITY_SELECT} WHERE c.id = $2`, [req.user!.sub, req.params.id])
    res.json(mapCommunity(full.rows[0]))
  }),
)
