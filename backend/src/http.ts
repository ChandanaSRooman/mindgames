import type { NextFunction, Request, RequestHandler, Response } from 'express'

/** Thrown by route handlers to return a specific status + message. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Wraps an async handler so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

/**
 * Terminal error middleware — maps ApiError to its status, else 500.
 *
 * body-parser rejects an oversized or malformed JSON body before any route
 * runs, and its error is not an ApiError — so every upload that breached the
 * limit surfaced to the user as "Internal server error" with no hint that the
 * file was simply too big.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  const type = (err as { type?: unknown } | null)?.type
  if (type === 'entity.too.large') {
    res.status(413).json({
      error: 'That upload is too large. Please attach smaller files and try again.',
    })
    return
  }
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed request body.' })
    return
  }
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
