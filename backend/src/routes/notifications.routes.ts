import { Router } from 'express'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { asyncHandler } from '../http.js'

export const notificationsRouter = Router()

interface NotificationRow {
  id: string
  type: string
  text: string
  actor_id: string | null
  read: boolean
  created_at: Date | string
}

// GET /api/notifications — the caller's notifications, newest first.
notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<NotificationRow>(
      `SELECT id, type, text, actor_id, read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [req.user!.sub],
    )
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        type: r.type,
        text: r.text,
        actorId: r.actor_id ?? undefined,
        read: r.read,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    )
  }),
)

// POST /api/notifications/:id/read — mark one notification read.
notificationsRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(`UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.sub,
    ])
    res.json({ ok: true })
  }),
)

// POST /api/notifications/read-all — mark everything read.
notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`, [
      req.user!.sub,
    ])
    res.json({ ok: true })
  }),
)
