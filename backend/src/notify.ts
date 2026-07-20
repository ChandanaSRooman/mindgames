import { query } from './db/pool.js'
import { emitTo, emitToAll } from './realtime.js'

type NotificationType =
  | 'connection'
  | 'like'
  | 'comment'
  | 'job'
  | 'mentorship'
  | 'community'
  | 'announcement'
  | 'event'

/**
 * Insert a notification for one recipient. Fire-and-forget from routes —
 * failures are logged, never surfaced to the triggering request.
 */
export async function pushNotification(
  userId: string,
  type: NotificationType,
  text: string,
  actorId?: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, text, actor_id) VALUES ($1,$2,$3,$4)`,
      [userId, type, text, actorId ?? null],
    )
    emitTo(userId, 'notification')
  } catch (err) {
    console.error('notification insert failed:', err instanceof Error ? err.message : err)
  }
}

/** Notify every user except the actor (used for Rooman announcements). */
export async function pushNotificationToAll(
  type: NotificationType,
  text: string,
  actorId: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, text, actor_id)
       SELECT id, $1, $2, $3 FROM users WHERE id <> $3`,
      [type, text, actorId],
    )
    emitToAll('notification')
  } catch (err) {
    console.error('broadcast notification failed:', err instanceof Error ? err.message : err)
  }
}
