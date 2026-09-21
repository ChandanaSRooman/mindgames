import { Router } from 'express'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { asyncHandler } from '../http.js'
import { mapNotification, type NotificationRow } from '../mappers.js'

export const notificationsRouter = Router()

// GET /api/notifications — the caller's notifications, newest first.
notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<NotificationRow>(
      `SELECT id, type, text, actor_id, target_type, target_id, read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [req.user!.sub],
    )
    res.json(result.rows.map(mapNotification))
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
