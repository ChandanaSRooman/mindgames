import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'

export const reportsRouter = Router()

const createSchema = z.object({
  targetType: z.enum(['post', 'user']),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3, 'Please describe the problem').max(500),
})

// POST /api/reports — flag a post or member for admin review.
reportsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { targetType, targetId, reason } = parsed.data

    const exists = await query(
      targetType === 'post' ? `SELECT 1 FROM posts WHERE id = $1` : `SELECT 1 FROM users WHERE id = $1`,
      [targetId],
    )
    if (!exists.rowCount) throw new ApiError(404, 'That content no longer exists')

    // One open report per (reporter, target) — repeat flags are a no-op.
    const dup = await query(
      `SELECT 1 FROM reports WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`,
      [req.user!.sub, targetType, targetId],
    )
    if (dup.rowCount) return res.json({ ok: true, already: true })

    await query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)`,
      [req.user!.sub, targetType, targetId, reason],
    )
    const admins = await query<{ id: string }>(`SELECT id FROM users WHERE is_admin`)
    for (const a of admins.rows) {
      void pushNotification(a.id, 'announcement', `A ${targetType} was reported: "${reason.slice(0, 80)}"`, req.user!.sub)
    }
    res.status(201).json({ ok: true })
  }),
)

// GET /api/reports — admin review queue (open first, then recent handled).
reportsRouter.get(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await query<{
      id: string
      target_type: string
      target_id: string
      reason: string
      status: string
      created_at: Date
      reporter_name: string
      post_content: string | null
      post_author: string | null
      user_name: string | null
    }>(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
              rep.name AS reporter_name,
              p.content AS post_content, pa.name AS post_author,
              tu.name AS user_name
       FROM reports r
       JOIN users rep ON rep.id = r.reporter_id
       LEFT JOIN posts p ON r.target_type = 'post' AND p.id = r.target_id
       LEFT JOIN users pa ON pa.id = p.author_id
       LEFT JOIN users tu ON r.target_type = 'user' AND tu.id = r.target_id
       ORDER BY (r.status = 'open') DESC, r.created_at DESC
       LIMIT 100`,
    )
    res.json(
      rows.rows.map((r) => ({
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        status: r.status,
        reporterName: r.reporter_name,
        // Snapshot of what was reported (post may have been deleted since).
        summary:
          r.target_type === 'post'
            ? r.post_content
              ? `Post by ${r.post_author}: "${r.post_content.slice(0, 120)}"`
              : '(post already removed)'
            : `Member: ${r.user_name ?? '(deleted account)'}`,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    )
  }),
)

const actionSchema = z.object({ removePost: z.boolean().optional() })

// POST /api/reports/:id/resolve — optionally remove the offending post.
reportsRouter.post(
  '/:id/resolve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = actionSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw new ApiError(400, 'invalid body')
    const rep = await query<{ target_type: string; target_id: string; reporter_id: string }>(
      `SELECT target_type, target_id, reporter_id FROM reports WHERE id = $1`,
      [req.params.id],
    )
    if (!rep.rowCount) throw new ApiError(404, 'Report not found')

    if (parsed.data.removePost && rep.rows[0].target_type === 'post') {
      await query(`DELETE FROM posts WHERE id = $1`, [rep.rows[0].target_id])
    }
    await query(`UPDATE reports SET status = 'resolved' WHERE id = $1`, [req.params.id])
    void pushNotification(
      rep.rows[0].reporter_id,
      'announcement',
      'Thanks for your report — the admin team has reviewed and actioned it.',
    )
    res.json({ ok: true })
  }),
)

// POST /api/reports/:id/dismiss — nothing wrong here.
reportsRouter.post(
  '/:id/dismiss',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query(`UPDATE reports SET status = 'dismissed' WHERE id = $1`, [req.params.id])
    if (!upd.rowCount) throw new ApiError(404, 'Report not found')
    res.json({ ok: true })
  }),
)
