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

/** Terminal error middleware — maps ApiError to its status, else 500. */
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
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
