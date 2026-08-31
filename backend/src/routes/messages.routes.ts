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
  attachment_name: string | null
  attachment_type: string | null
  edited_at: Date | string | null
}

const ATTACHMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const EDIT_WINDOW_MS = 5 * 60 * 1000

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
      `SELECT id, conversation_id, sender_id, body, created_at, attachment_name, attachment_type, edited_at
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
    lastMessage: last ? last.body || (last.attachment_name ? `📎 ${last.attachment_name}` : '') : '',
    unread,
    lastAt: last ? new Date(last.created_at).getTime() : 0,
    messages: msgs.map((m) => ({
      id: m.id,
      fromMe: m.sender_id === me,
      text: m.body,
      time: formatMsgTime(m.created_at),
      createdAt: new Date(m.created_at).toISOString(),
      editedAt: m.edited_at ? new Date(m.edited_at).toISOString() : undefined,
      attachment: m.attachment_name
        ? { name: m.attachment_name, type: m.attachment_type! }
        : undefined,
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

const sendSchema = z
  .object({
    text: z.string().trim().max(4000).optional(),
    attachment: z
      .object({
        name: z.string().min(1).max(200),
        dataBase64: z.string().min(1),
        mediaType: z.string(),
      })
      .optional(),
  })
  .refine((v) => (v.text && v.text.length > 0) || v.attachment, {
    message: 'Write a message or attach a file.',
  })

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

    let attachmentName: string | null = null
    let attachmentType: string | null = null
    let attachmentData: Buffer | null = null
    if (parsed.data.attachment) {
      const { name, dataBase64, mediaType } = parsed.data.attachment
      if (!ATTACHMENT_TYPES.includes(mediaType)) {
        throw new ApiError(400, 'Attachments must be a PDF or .docx file.')
      }
      // ~5MB file ≈ 6.7M base64 chars.
      if (dataBase64.length > 7_000_000) {
        throw new ApiError(413, 'File is too large — please keep it under 5MB.')
      }
      attachmentData = Buffer.from(dataBase64.replace(/\s/g, ''), 'base64')
      if (!attachmentData.length) throw new ApiError(400, 'Attached file was empty — please re-attach it.')
      attachmentName = name.slice(0, 200)
      attachmentType = mediaType
    }

    const ins = await query<{ id: string; created_at: Date }>(
      `INSERT INTO messages (conversation_id, sender_id, body, attachment_name, attachment_type, attachment_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [convId, me, parsed.data.text?.trim() || '', attachmentName, attachmentType, attachmentData],
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
      text: parsed.data.text?.trim() || '',
      time: formatMsgTime(ins.rows[0].created_at),
      createdAt: new Date(ins.rows[0].created_at).toISOString(),
      attachment: attachmentName ? { name: attachmentName, type: attachmentType! } : undefined,
    })
  }),
)

const editSchema = z.object({ text: z.string().trim().min(1, 'message text is required').max(4000) })

// PATCH /api/messages/:conversationId/:messageId — edit a message's text.
// Only the sender may edit, and only within EDIT_WINDOW_MS of sending.
messagesRouter.patch(
  '/:conversationId/:messageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const { conversationId, messageId } = req.params
    const parsed = editSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)

    const msg = await query<{ sender_id: string; created_at: Date }>(
      `SELECT sender_id, created_at FROM messages WHERE id = $1 AND conversation_id = $2`,
      [messageId, conversationId],
    )
    if (!msg.rowCount) throw new ApiError(404, 'Message not found')
    if (msg.rows[0].sender_id !== me) throw new ApiError(403, 'You can only edit your own messages')
    if (Date.now() - new Date(msg.rows[0].created_at).getTime() > EDIT_WINDOW_MS) {
      throw new ApiError(400, 'This message can no longer be edited (5 minute limit).')
    }

    const upd = await query<{
      created_at: Date
      edited_at: Date
      attachment_name: string | null
      attachment_type: string | null
    }>(
      `UPDATE messages SET body = $1, edited_at = now() WHERE id = $2
       RETURNING created_at, edited_at, attachment_name, attachment_type`,
      [parsed.data.text.trim(), messageId],
    )

    const conv = await query<{ user_lo: string; user_hi: string }>(
      `SELECT user_lo, user_hi FROM conversations WHERE id = $1`,
      [conversationId],
    )
    if (conv.rowCount) {
      const other = conv.rows[0].user_lo === me ? conv.rows[0].user_hi : conv.rows[0].user_lo
      emitTo(other, 'message')
    }

    const r = upd.rows[0]
    res.json({
      id: messageId,
      fromMe: true,
      text: parsed.data.text.trim(),
      time: formatMsgTime(r.created_at),
      createdAt: new Date(r.created_at).toISOString(),
      editedAt: new Date(r.edited_at).toISOString(),
      attachment: r.attachment_name ? { name: r.attachment_name, type: r.attachment_type! } : undefined,
    })
  }),
)

// GET /api/messages/attachments/:messageId — download a message's attached
// file. Only the two participants in that conversation may fetch it.
messagesRouter.get(
  '/attachments/:messageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const row = await query<{
      attachment_name: string | null
      attachment_type: string | null
      attachment_data: Buffer | null
      user_lo: string
      user_hi: string
    }>(
      `SELECT m.attachment_name, m.attachment_type, m.attachment_data, c.user_lo, c.user_hi
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1`,
      [req.params.messageId],
    )
    if (!row.rowCount) throw new ApiError(404, 'Message not found')
    const m = row.rows[0]
    if (me !== m.user_lo && me !== m.user_hi) throw new ApiError(403, 'Not your conversation')
    if (!m.attachment_data) throw new ApiError(404, 'This message has no attachment')

    res.setHeader('Content-Type', m.attachment_type ?? 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(m.attachment_name ?? 'file').replace(/[^\w.\- ]/g, '_')}"`,
    )
    res.send(m.attachment_data)
  }),
)
