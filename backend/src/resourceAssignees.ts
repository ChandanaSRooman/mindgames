import { query } from './db/pool.js'

/**
 * Gives every session resource its recipient (assigned_to = the session's
 * mentee), once at startup.
 *
 * Why at startup and not only in the migration: a deploy runs the migration
 * while the OLD server is still up, and restarts it a few seconds later. The
 * migration's one-off backfill (schema.sql, `backfill_resources_assigned_to`)
 * covers every row before it, but old code doesn't know the column — a mentor
 * completing a session in that window writes a follow-up with assigned_to
 * NULL, and the mentee's list and submit check, which go by assigned_to, would
 * never show it to them. This runs the moment the new code takes over, so that
 * window closes on every deploy.
 *
 * Cheap at any size: idx_career_resources_unassigned_session holds only
 * session rows still missing a recipient, which is almost always none.
 * Mentee-owned rows from before 48c502f stay unmatched (user_id is not the
 * mentor's) and are left as they are, exactly as the migration leaves them.
 * Idempotent; a failure is logged and never stops the server starting.
 */
export async function backfillSessionAssignees(): Promise<void> {
  try {
    const r = await query(
      `UPDATE career_resources r
          SET assigned_to = s.mentee_id
         FROM mentorship_sessions s
        WHERE r.session_id = s.id
          AND r.session_id IS NOT NULL
          AND r.assigned_to IS NULL
          AND r.user_id = s.mentor_id`,
    )
    if (r.rowCount) console.log(`[resources] gave ${r.rowCount} session resource(s) their recipient`)
  } catch (err) {
    console.error('[resources] session-recipient backfill failed:', err)
  }
}
