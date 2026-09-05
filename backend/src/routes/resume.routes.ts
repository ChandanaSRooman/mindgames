import { Router } from 'express'
import { ApiError, asyncHandler } from '../http.js'
import { requireAuth } from '../auth/middleware.js'
import { parseResume, ResumeParseError } from '../ai.js'

export const resumeRouter = Router()

// Resume parsing is by far the most expensive thing this server does per
// request: it spawns a child process to read the PDF and then holds the handler
// open across an AI call. Left uncapped, a handful of concurrent 15MB uploads
// can spawn enough extraction processes to starve the box, so parses queue at a
// fixed ceiling and callers beyond it get a 503 telling them to retry.
// The ceiling is per Node process — this app runs single-instance.
const MAX_CONCURRENT_PARSES = 2
let parsesInFlight = 0

// POST /api/resume/parse — real AI extraction for PDF/DOCX via the configured
// provider (OpenRouter/NVIDIA by default). An unconfigured server returns 503:
// failures surface as real errors rather than invented profile data, since the
// caller merges the result straight into the member's onboarding form.
//
// requireAuth: onboarding always runs behind a login (the /onboarding route is
// wrapped in RequireAuth and the API client sends the bearer token), so gating
// this costs nothing and keeps anonymous callers from spending the shared
// free-tier request quota — or the extraction processes above.
resumeRouter.post(
  '/parse',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (parsesInFlight >= MAX_CONCURRENT_PARSES) {
      throw new ApiError(503, 'Too many resumes are being parsed right now. Please try again in a moment.')
    }
    const { dataBase64, mediaType } = req.body ?? {}
    parsesInFlight++
    try {
      const result = await parseResume(dataBase64, mediaType)
      res.json(result)
    } catch (err) {
      if (err instanceof ResumeParseError) throw new ApiError(err.status, err.message)
      throw err
    } finally {
      parsesInFlight--
    }
  }),
)
