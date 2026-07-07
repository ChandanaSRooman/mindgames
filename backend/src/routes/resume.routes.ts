import { Router } from 'express'
import { asyncHandler } from '../http.js'
import { parseResume } from '../ai.js'

export const resumeRouter = Router()

// POST /api/resume/parse — real AI extraction via Claude Haiku when ANT_KEY is
// set; falls back to a mock result otherwise (see ai.ts).
resumeRouter.post(
  '/parse',
  asyncHandler(async (req, res) => {
    const { dataBase64, mediaType } = req.body ?? {}
    const result = await parseResume(dataBase64, mediaType)
    res.json(result)
  }),
)
