import { query, withTransaction } from './db/pool.js'
import { arr, startYearOf } from './mappers.js'

// Career paths: one row per observed role transition an alumnus made
// ("Backend Developer" -> "Cloud Engineer"), derived automatically from the
// same users.experience JSONB the company-roadmap feature already reads (see
// mapCompanyRoadmap in mappers.ts) — no new data entry required from anyone.
//
// Rows are re-derived from scratch on every call rather than inserted once:
// a profile edit (a role renamed, an entry removed) must not leave a stale
// edge behind forever, and DELETE-then-INSERT inside one transaction is the
// simplest way to guarantee that without a separate cleanup job.

/** Lowercase/trimmed so "Backend Developer" and "backend developer " match
 * as the same node. Display code title-cases this back at render time. */
export function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface ExperienceRow {
  id: string
  experience: unknown
}

/** Consecutive-entry role transitions for one user's experience timeline,
 * oldest-first (same ordering rule as mapCompanyRoadmap). Entries with no
 * parseable period keep their given array order rather than being guessed
 * into a position the data doesn't support. */
function transitionsFor(experience: unknown): Array<{ from: string; to: string }> {
  const entries = arr(experience)
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .map((e, i) => ({ role: String(e.role ?? '').trim(), sortKey: startYearOf(e.period), i }))
    .filter((e) => e.role !== '')
    .sort((a, b) => {
      if (a.sortKey === null && b.sortKey === null) return a.i - b.i
      if (a.sortKey === null) return 1
      if (b.sortKey === null) return -1
      return a.sortKey - b.sortKey || a.i - b.i
    })

  const transitions: Array<{ from: string; to: string }> = []
  for (let i = 1; i < entries.length; i++) {
    const from = normalizeRole(entries[i - 1].role)
    const to = normalizeRole(entries[i].role)
    if (from && to && from !== to) transitions.push({ from, to })
  }
  return transitions
}

/** Re-derive one member's career_paths rows from their current profile. Called
 * synchronously right after they submit a career assessment, so their own
 * transitions are guaranteed fresh even between the periodic full backfill. */
export async function deriveCareerPathsForUser(userId: string): Promise<void> {
  const r = await query<ExperienceRow>('SELECT id, experience FROM users WHERE id = $1', [userId])
  if (!r.rowCount) return
  const transitions = transitionsFor(r.rows[0].experience)

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM career_paths WHERE user_id = $1 AND source = 'auto'`, [userId])
    for (const t of transitions) {
      await client.query(
        `INSERT INTO career_paths (user_id, from_role, to_role, source) VALUES ($1, $2, $3, 'auto')
         ON CONFLICT (user_id, from_role, to_role) DO NOTHING`,
        [userId, t.from, t.to],
      )
    }
  })
}

/** Re-derive career_paths for every member. Run once at server startup
 * (idempotent — safe to run again on every restart) so existing profiles get
 * paths without a manual migration step. Cheap at current scale: one query
 * to read every experience column, one transaction to replace the 'auto' set. */
export async function backfillCareerPaths(): Promise<void> {
  const rows = await query<ExperienceRow>('SELECT id, experience FROM users')
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM career_paths WHERE source = 'auto'`)
    for (const row of rows.rows) {
      for (const t of transitionsFor(row.experience)) {
        await client.query(
          `INSERT INTO career_paths (user_id, from_role, to_role, source) VALUES ($1, $2, $3, 'auto')
           ON CONFLICT (user_id, from_role, to_role) DO NOTHING`,
          [row.id, t.from, t.to],
        )
      }
    }
  })
  console.log(`career_paths backfilled from ${rows.rowCount ?? 0} profiles`)
}

export interface PathChain {
  roles: string[]
  /** One alumnus id per hop in `roles` (roles.length - 1 entries), for
   * "alumni who took this step" links. */
  userIdsByHop: string[]
}

/** Finds up to 5 alumni-walked chains from `fromRole` toward `toRole` using a
 * recursive CTE over career_paths (a small, explicit relational graph — see
 * the architecture discussion for why this replaces a generic graph store).
 * Depth capped at 4 hops: long past that stops being a legible "path" to show
 * a member and starts being noise. */
export async function findCareerPathChains(fromRole: string, toRole: string): Promise<PathChain[]> {
  const from = normalizeRole(fromRole)
  const to = normalizeRole(toRole)
  if (!from || !to) return []

  const rows = await query<{ roles: string[]; user_ids: string[] }>(
    `WITH RECURSIVE chain AS (
       SELECT from_role, to_role, ARRAY[from_role, to_role] AS roles, ARRAY[user_id] AS user_ids, 1 AS depth
         FROM career_paths WHERE from_role = $1
       UNION ALL
       SELECT cp.from_role, cp.to_role, chain.roles || cp.to_role, chain.user_ids || cp.user_id, chain.depth + 1
         FROM career_paths cp
         JOIN chain ON cp.from_role = chain.to_role
        WHERE chain.depth < 4 AND NOT cp.to_role = ANY(chain.roles)
     )
     SELECT DISTINCT roles, user_ids FROM chain WHERE to_role = $2
     LIMIT 5`,
    [from, to],
  )
  return rows.rows.map((r) => ({ roles: r.roles, userIdsByHop: r.user_ids }))
}

/** Alumni whose own history started at (or passed through) roughly where this
 * member is now, or who reached roughly where this member wants to go —
 * the two deterministic "similar path" queries from the design discussion.
 * Falls back to an empty list rather than guessing when either role is blank. */
export async function findSimilarPathAlumni(
  currentRole: string,
  targetRole: string,
): Promise<{ userId: string; fromRole: string; toRole: string }[]> {
  const from = normalizeRole(currentRole)
  const to = normalizeRole(targetRole)
  if (!from && !to) return []

  const rows = await query<{ user_id: string; from_role: string; to_role: string }>(
    `SELECT DISTINCT user_id, from_role, to_role FROM career_paths
      WHERE ($1 <> '' AND from_role = $1) OR ($2 <> '' AND to_role = $2)
      LIMIT 20`,
    [from, to],
  )
  return rows.rows.map((r) => ({ userId: r.user_id, fromRole: r.from_role, toRole: r.to_role }))
}
