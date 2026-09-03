import { Router } from 'express'
import { ApiError, asyncHandler } from '../http.js'
import { parseResume, ResumeParseError } from '../ai.js'

export const resumeRouter = Router()

// POST /api/resume/parse — real AI extraction for PDF/DOCX via the configured
// provider (Claude/ANT_KEY by default). An unconfigured server returns 503:
// failures surface as real errors rather than invented profile data, since the
// caller merges the result straight into the member's onboarding form.
resumeRouter.post(
  '/parse',
  asyncHandler(async (req, res) => {
    const { dataBase64, mediaType } = req.body ?? {}
    try {
      const result = await parseResume(dataBase64, mediaType)
      res.json(result)
    } catch (err) {
      if (err instanceof ResumeParseError) throw new ApiError(err.status, err.message)
      throw err
    }
  }),
)
