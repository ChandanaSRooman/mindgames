import type { NextFunction, Request, Response } from 'express'
import { verifyToken, type JwtPayload } from './jwt.js'

// Augment Express Request with the authenticated user (set by these guards).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

/** Populates req.user if a valid token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req)
  if (token) {
    const payload = verifyToken(token)
    if (payload) req.user = payload
  }
  next()
}

/** Rejects the request with 401 unless a valid token is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req)
  const payload = token ? verifyToken(token) : null
  if (!payload) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  req.user = payload
  next()
}

/** Rejects unless the authenticated user is an admin. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
