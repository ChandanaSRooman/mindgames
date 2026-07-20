import { Router } from 'express'
import { ApiError, asyncHandler } from '../http.js'
import { parseResume, ResumeParseError } from '../ai.js'

export const resumeRouter = Router()

// POST /api/resume/parse — real AI extraction (Claude) for PDF/DOCX when
// ANT_KEY is set; a fixed demo result (source: 'fallback') otherwise.
// Parse failures surface as real errors instead of invented profile data.
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
