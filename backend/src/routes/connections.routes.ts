import { Router } from 'express'
import { query, withTransaction } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'

// Mark a pending request (requester → addressee) accepted and bump both
// users' connection counts atomically. Returns false if no pending row.
async function acceptPending(requester: string, addressee: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const upd = await client.query(
      `UPDATE connections SET status = 'accepted', updated_at = now()
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [requester, addressee],
    )
    if (!upd.rowCount) return false
    await client.query(
      `UPDATE users SET connections_count = connections_count + 1 WHERE id = ANY($1)`,
      [[requester, addressee]],
    )
    return true
  })
}

export const connectionsRouter = Router()

interface ConnRow {
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'ignored'
}

// GET /api/connections — the current user's graph, shaped for the store:
//   connectionIds      – accepted (either direction)
//   sentRequestIds     – pending requests I sent
//   pendingRequestIds  – pending requests awaiting my action
connectionsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const rows = (
      await query<ConnRow>(
        `SELECT requester_id, addressee_id, status FROM connections
         WHERE requester_id = $1 OR addressee_id = $1`,
        [me],
      )
    ).rows

    const connectionIds = new Set<string>()
    const sentRequestIds = new Set<string>()
    const pendingRequestIds = new Set<string>()
    for (const r of rows) {
      const other = r.requester_id === me ? r.addressee_id : r.requester_id
      if (r.status === 'accepted') connectionIds.add(other)
      else if (r.status === 'pending' && r.requester_id === me) sentRequestIds.add(other)
      else if (r.status === 'pending' && r.addressee_id === me) pendingRequestIds.add(other)
    }
    // A connected pair can also have a stale pending row in the other
    // direction — connected wins.
    for (const id of connectionIds) {
      sentRequestIds.delete(id)
      pendingRequestIds.delete(id)
    }
    res.json({
      connectionIds: [...connectionIds],
      sentRequestIds: [...sentRequestIds],
      pendingRequestIds: [...pendingRequestIds],
    })
  }),
)

// POST /api/connections/:id — send a connection request to :id.
// If :id already sent ME a pending request, connecting auto-accepts it
// (both wanted it) instead of creating a duplicate reverse request.
connectionsRouter.post(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const other = req.params.id
    if (other === me) throw new ApiError(400, 'Cannot connect to yourself')

    const target = await query('SELECT 1 FROM users WHERE id = $1', [other])
    if (!target.rowCount) throw new ApiError(404, 'User not found')

    const meRow = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
    const myName = meRow.rows[0].name

    // Already connected in either direction? No-op.
    const accepted = await query(
      `SELECT 1 FROM connections
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [me, other],
    )
    if (accepted.rowCount) return res.json({ ok: true, state: 'connected' })

    // Reverse pending → auto-accept.
    if (await acceptPending(other, me)) {
      void pushNotification(other, 'connection', `${myName} accepted your connection request.`, me)
      return res.json({ ok: true, state: 'connected' })
    }

    await query(
      `INSERT INTO connections (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (requester_id, addressee_id)
       DO UPDATE SET status = 'pending', updated_at = now()`,
      [me, other],
    )
    void pushNotification(other, 'connection', `${myName} sent you a connection request.`, me)
    res.status(201).json({ ok: true, state: 'pending' })
  }),
)

// POST /api/connections/:id/accept — accept a request :id sent to me.
// Bumps both users' connection counts.
connectionsRouter.post(
  '/:id/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    if (!(await acceptPending(req.params.id, me))) {
      throw new ApiError(404, 'No pending request from this user')
    }
    const meRow = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
    void pushNotification(
      req.params.id,
      'connection',
      `${meRow.rows[0].name} accepted your connection request.`,
      me,
    )
    res.json({ ok: true, state: 'connected' })
  }),
)

// POST /api/connections/:id/ignore — dismiss a request :id sent to me.
connectionsRouter.post(
  '/:id/ignore',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    await query(
      `UPDATE connections SET status = 'ignored', updated_at = now()
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [req.params.id, me],
    )
    res.json({ ok: true, state: 'none' })
  }),
)

// DELETE /api/connections/:id — withdraw a request I sent to :id. Marked
// 'ignored' rather than deleted so the row's history is kept; the POST /:id
// handler already reactivates an 'ignored' row to 'pending' on a fresh send.
connectionsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    await query(
      `UPDATE connections SET status = 'ignored', updated_at = now()
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [me, req.params.id],
    )
    res.json({ ok: true, state: 'none' })
  }),
)
