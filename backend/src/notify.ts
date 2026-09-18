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
  | 'message'

/**
 * What a notification is about, so the UI can link to the thing itself.
 *
 * Without this, routing can only be per-type: every "X commented on your post"
 * lands on the top of the feed, whichever post it was. The id points at one of
 * several tables depending on `type`, which is why there is no foreign key on
 * the column — see the comment in schema.sql.
 */
export type NotificationTarget = {
  type: 'post' | 'event' | 'community' | 'user' | 'company' | 'startup' | 'session' | 'conversation'
  id: string
}

/**
 * Insert a notification for one recipient. Fire-and-forget from routes —
 * failures are logged, never surfaced to the triggering request.
 *
 * `target` is optional so that adding it did not have to touch all forty-odd
 * existing call sites at once; a notification without one still routes by type,
 * exactly as before.
 */
export async function pushNotification(
  userId: string,
  type: NotificationType,
  text: string,
  actorId?: string,
  target?: NotificationTarget,
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, text, actor_id, target_type, target_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, type, text, actorId ?? null, target?.type ?? null, target?.id ?? null],
    )
    emitTo(userId, 'notification')
  } catch (err) {
    console.error('notification insert failed:', err instanceof Error ? err.message : err)
  }
}

/**
 * Insert a notification only if the recipient has no UNREAD one of the same
 * type pointing at the same target.
 *
 * For messages. One notification per message makes the bell unusable — a
 * twenty-message exchange would bury everything else — while one per
 * conversation says exactly as much ("you have unread messages from X") and
 * mirrors how the chat panel's unread markers already behave. Reading the
 * conversation clears it, so the next message notifies again.
 *
 * The guard is inside a single INSERT ... WHERE NOT EXISTS rather than a
 * SELECT followed by an INSERT: two messages arriving together would both pass
 * a separate check and insert two rows.
 */
export async function pushNotificationOncePerTarget(
  userId: string,
  type: NotificationType,
  text: string,
  actorId: string | undefined,
  target: NotificationTarget,
): Promise<void> {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, type, text, actor_id, target_type, target_id)
       SELECT $1,$2,$3,$4,$5,$6
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications
           WHERE user_id = $1 AND type = $2
             AND target_type = $5 AND target_id = $6
             AND NOT read
        )`,
      [userId, type, text, actorId ?? null, target.type, target.id],
    )
    // Only poke the client when a row was actually written. A suppressed
    // duplicate must not trigger a notification refetch.
    if (result.rowCount) emitTo(userId, 'notification')
  } catch (err) {
    console.error('notification insert failed:', err instanceof Error ? err.message : err)
  }
}

/** Notify every user except the actor (used for Rooman announcements). */
export async function pushNotificationToAll(
  type: NotificationType,
  text: string,
  actorId: string,
  target?: NotificationTarget,
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, text, actor_id, target_type, target_id)
       SELECT id, $1, $2, $3, $4, $5 FROM users WHERE id <> $3`,
      [type, text, actorId, target?.type ?? null, target?.id ?? null],
    )
    emitToAll('notification')
  } catch (err) {
    console.error('broadcast notification failed:', err instanceof Error ? err.message : err)
  }
}
