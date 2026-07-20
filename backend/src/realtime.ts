import type { Request, Response } from 'express'
import { verifyToken } from './auth/jwt.js'

/**
 * Server-Sent Events hub. Clients connect to GET /api/stream?token=<jwt>
 * (EventSource can't set headers, so the JWT rides in the query string) and
 * receive named events — currently 'notification' and 'message' — which the
 * frontend uses as "go refetch now" pokes instead of waiting for its polls.
 */
const clients = new Map<string, Set<Response>>()

export function sseHandler(req: Request, res: Response): void {
  const payload = verifyToken(String(req.query.token ?? ''))
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write(': connected\n\n')

  const uid = payload.sub
  if (!clients.has(uid)) clients.set(uid, new Set())
  clients.get(uid)!.add(res)

  // Keep intermediaries (vite proxy, LBs) from timing the stream out.
  const heartbeat = setInterval(() => {
    try {
      res.write(': hb\n\n')
    } catch {
      /* closed */
    }
  }, 25_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    const set = clients.get(uid)
    set?.delete(res)
    if (set && set.size === 0) clients.delete(uid)
  })
}

export function emitTo(userId: string, event: string, data: unknown = {}): void {
  const set = clients.get(userId)
  if (!set) return
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of set) {
    try {
      res.write(frame)
    } catch {
      /* connection died; close handler cleans up */
    }
  }
}

export function emitToAll(event: string, data: unknown = {}): void {
  for (const uid of [...clients.keys()]) emitTo(uid, event, data)
}
