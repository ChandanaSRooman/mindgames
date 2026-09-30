import type pg from 'pg'
import { withTransaction } from './db/pool.js'

/**
 * Every write to `connections` goes through here.
 *
 * Three things can change whether two members are connected: one of them
 * clicking Connect, the other accepting, and (since sessions connect people)
 * a mentor or mentee agreeing a mentorship session. They used to be separate
 * pieces of SQL, and two of them running at the same moment for the same
 * pair could each read the old state and act on it — counting one connection
 * twice, or turning a fresh connection back into a pending request.
 *
 * So each one takes the same per-pair lock first and does its read-then-write
 * while holding it. Two changes to the same pair now queue behind each other;
 * different pairs never wait on each other. Every UPDATE also re-checks the
 * status it expects, so a count is only bumped for a row this call actually
 * moved to 'accepted'.
 */

type Db = pg.PoolClient

/** Held until the surrounding transaction ends. Same key whichever order the
 *  two ids arrive in. */
async function lockPair(db: Db, a: string, b: string): Promise<void> {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`connection:${lo}:${hi}`])
}

async function pairRows(db: Db, a: string, b: string) {
  const r = await db.query<{ requester_id: string; addressee_id: string; status: string }>(
    `SELECT requester_id, addressee_id, status FROM connections
      WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [a, b],
  )
  return r.rows
}

async function bumpCounts(db: Db, a: string, b: string): Promise<void> {
  await db.query(`UPDATE users SET connections_count = connections_count + 1 WHERE id = ANY($1)`, [[a, b]])
}

/** Run in the caller's transaction when given one, otherwise in a new one. */
function inTransaction<T>(client: Db | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
  return client ? fn(client) : withTransaction(fn)
}

/**
 * Accept the pending request `requester` sent to `addressee`.
 * True when there was such a request and the two are now connected; false
 * when there was no pending request to accept. Counts are bumped only when
 * this call is what connected them.
 */
export function acceptPendingRequest(requester: string, addressee: string, client?: Db): Promise<boolean> {
  return inTransaction(client, async (db) => {
    await lockPair(db, requester, addressee)
    const rows = await pairRows(db, requester, addressee)
    const pending = rows.some(
      (r) => r.requester_id === requester && r.addressee_id === addressee && r.status === 'pending',
    )
    if (!pending) return false
    // A stale request left over from before they connected the other way
    // round (real data has these). They're already connected, so accepting
    // it must not count the same connection a second time.
    if (rows.some((r) => r.status === 'accepted')) return true
    const upd = await db.query(
      `UPDATE connections SET status = 'accepted', updated_at = now()
        WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [requester, addressee],
    )
    if (!upd.rowCount) return false
    await bumpCounts(db, requester, addressee)
    return true
  })
}

/**
 * `me` clicks Connect on `other`.
 *   'already'  — they were already connected; nothing changed
 *   'accepted' — `other` had already asked `me`, so this accepts that
 *   'pending'  — a request from `me` is now waiting on `other`
 */
export function requestConnection(
  me: string,
  other: string,
  note: string | null,
): Promise<'already' | 'accepted' | 'pending'> {
  return withTransaction(async (db) => {
    await lockPair(db, me, other)
    const rows = await pairRows(db, me, other)
    if (rows.some((r) => r.status === 'accepted')) return 'already'

    if (rows.some((r) => r.requester_id === other && r.status === 'pending')) {
      await acceptPendingRequest(other, me, db)
      return 'accepted'
    }

    // The WHERE guard is belt-and-braces under the lock: an existing row is
    // only ever reset to 'pending' from pending/ignored, never from accepted.
    await db.query(
      `INSERT INTO connections (requester_id, addressee_id, status, note)
       VALUES ($1, $2, 'pending', $3)
       ON CONFLICT (requester_id, addressee_id)
       DO UPDATE SET status = 'pending', note = $3, updated_at = now()
       WHERE connections.status <> 'accepted'`,
      [me, other, note],
    )
    return 'pending'
  })
}

/**
 * Connect two members if they aren't already — used when a mentorship
 * session is agreed by both sides. Agreeing to meet is the strongest reason
 * two members know each other; not at request time, since the mentor can
 * still decline and booking must not let anyone force a connection.
 *
 * Whatever is already there between the pair is reused: a pending request
 * (either direction) or an old ignored one becomes the connection, and only
 * when there is nothing at all is a new row inserted. Nothing is deleted — a
 * leftover pending row the other way is harmless, as GET /api/connections
 * already hides a stale request between two connected members.
 *
 * Pass `client` to make this part of the caller's transaction, so the session
 * becoming agreed and the pair becoming connected succeed or fail together.
 * True only if this call connected them.
 */
export function ensureConnected(a: string, b: string, client?: Db): Promise<boolean> {
  if (a === b) return Promise.resolve(false)
  return inTransaction(client, async (db) => {
    await lockPair(db, a, b)
    const rows = await pairRows(db, a, b)
    if (rows.some((r) => r.status === 'accepted')) return false

    // A live pending request before an old ignored one, so the request a
    // member can see is the one that turns into the connection.
    const existing = rows.find((r) => r.status === 'pending') ?? rows[0]
    if (existing) {
      const upd = await db.query(
        `UPDATE connections SET status = 'accepted', updated_at = now()
          WHERE requester_id = $1 AND addressee_id = $2 AND status <> 'accepted'`,
        [existing.requester_id, existing.addressee_id],
      )
      if (!upd.rowCount) return false
    } else {
      await db.query(
        `INSERT INTO connections (requester_id, addressee_id, status) VALUES ($1, $2, 'accepted')`,
        [a, b],
      )
    }
    await bumpCounts(db, a, b)
    return true
  })
}
