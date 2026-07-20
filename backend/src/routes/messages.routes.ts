import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { emitTo } from '../realtime.js'
import { formatMsgTime } from '../mappers.js'

export const messagesRouter = Router()

interface MsgRow {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: Date | string
}

// Build the MessageThread shape (matching frontend types) for one conversation.
async function buildThread(convId: string, me: string) {
  const conv = await query<{ id: string; with_user_id: string; last_read_at: Date | null }>(
    `SELECT c.id,
            CASE WHEN c.user_lo = $2 THEN c.user_hi ELSE c.user_lo END AS with_user_id,
            cr.last_read_at
     FROM conversations c
     LEFT JOIN conversation_reads cr ON cr.conversation_id = c.id AND cr.user_id = $2
     WHERE c.id = $1`,
    [convId, me],
  )
  if (!conv.rowCount) return null
  const row = conv.rows[0]
  const msgs = (
    await query<MsgRow>(
      `SELECT id, conversation_id, sender_id, body, created_at
       FROM messages WHERE conversation_id = $1 ORDER BY created_at`,
      [convId],
    )
  ).rows
  const lastReadAt = row.last_read_at ? new Date(row.last_read_at).getTime() : 0
  const unread = msgs.filter(
    (m) => m.sender_id !== me && new Date(m.created_at).getTime() > lastReadAt,
  ).length
  const last = msgs[msgs.length - 1]
  return {
    id: row.id,
    withUserId: row.with_user_id,
    lastMessage: last ? last.body : '',
    unread,
    lastAt: last ? new Date(last.created_at).getTime() : 0,
    messages: msgs.map((m) => ({
      id: m.id,
      fromMe: m.sender_id === me,
      text: m.body,
      time: formatMsgTime(m.created_at),
    })),
  }
}

// GET /api/messages/threads — all of the current user's conversations, newest first.
messagesRouter.get(
  '/threads',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const ids = (
      await query<{ id: string }>(
        `SELECT id FROM conversations WHERE user_lo = $1 OR user_hi = $1`,
        [me],
      )
    ).rows.map((r) => r.id)

    const threads = (await Promise.all(ids.map((id) => buildThread(id, me)))).filter(
      (t): t is NonNullable<typeof t> => !!t,
    )
    threads.sort((a, b) => b.lastAt - a.lastAt)
    res.json(threads.map(({ lastAt: _lastAt, ...t }) => t))
  }),
)

const startSchema = z.object({ userId: z.string().min(1) })

// POST /api/messages/thread — get-or-create a conversation with { userId }.
messagesRouter.post(
  '/thread',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const parsed = startSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, 'userId is required')
    const other = parsed.data.userId
    if (other === me) throw new ApiError(400, 'Cannot message yourself')

    const target = await query('SELECT 1 FROM users WHERE id = $1', [other])
    if (!target.rowCount) throw new ApiError(404, 'User not found')

    const [lo, hi] = [me, other].sort()
    const upsert = await query<{ id: string }>(
      `INSERT INTO conversations (user_lo, user_hi) VALUES ($1, $2)
       ON CONFLICT (user_lo, user_hi) DO UPDATE SET user_lo = EXCLUDED.user_lo
       RETURNING id`,
      [lo, hi],
    )
    const thread = await buildThread(upsert.rows[0].id, me)
    const { lastAt: _lastAt, ...rest } = thread!
    res.status(201).json(rest)
  }),
)

const sendSchema = z.object({ text: z.string().trim().min(1, 'message text is required') })

// POST /api/messages/:conversationId/read — mark the conversation read for me.
messagesRouter.post(
  '/:conversationId/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    await query(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
       VALUES ($1, $2, now())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now()`,
      [req.params.conversationId, me],
    )
    res.json({ ok: true })
  }),
)

// POST /api/messages/:conversationId — send a message; returns the created message.
messagesRouter.post(
  '/:conversationId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const convId = req.params.conversationId
    const parsed = sendSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)

    const member = await query(
      `SELECT 1 FROM conversations WHERE id = $1 AND ($2 = user_lo OR $2 = user_hi)`,
      [convId, me],
    )
    if (!member.rowCount) throw new ApiError(404, 'Conversation not found')

    const ins = await query<{ id: string; created_at: Date }>(
      `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [convId, me, parsed.data.text],
    )
    // Sending implies I've read up to now.
    await query(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
       VALUES ($1, $2, now())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now()`,
      [convId, me],
    )
    // Poke the other participant's open tabs so the chat updates instantly.
    const conv = await query<{ user_lo: string; user_hi: string }>(
      `SELECT user_lo, user_hi FROM conversations WHERE id = $1`,
      [convId],
    )
    if (conv.rowCount) {
      const other = conv.rows[0].user_lo === me ? conv.rows[0].user_hi : conv.rows[0].user_lo
      emitTo(other, 'message')
    }

    res.status(201).json({
      id: ins.rows[0].id,
      fromMe: true,
      text: parsed.data.text,
      time: formatMsgTime(ins.rows[0].created_at),
    })
  }),
)
