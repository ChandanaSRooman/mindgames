import { Router } from 'express'
import { z } from 'zod'
import { query, withTransaction } from '../db/pool.js'
import { optionalAuth, requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { mapComment, mapPost, type CommentRow, type PostRow } from '../mappers.js'
import { pushNotification, pushNotificationToAll } from '../notify.js'

export const postsRouter = Router()

const POST_SELECT = `
  SELECT p.id, p.author_id, p.type, p.content, p.image, p.visibility, p.community_id,
         p.domain, p.city, p.batch, p.role, p.company, p.questions, p.wants_resume, p.active, p.pinned, p.likes, p.created_at,
         EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked_by_me,
         EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = $1) AS saved_by_me,
         EXISTS (SELECT 1 FROM job_applications ja WHERE ja.post_id = p.id AND ja.applicant_id = $1) AS applied_by_me,
         (SELECT count(*)::int FROM job_applications ja WHERE ja.post_id = p.id) AS applicants_count,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', c.id, 'author_id', c.author_id, 'text', c.text, 'created_at', c.created_at
           ) ORDER BY c.created_at)
           FROM comments c WHERE c.post_id = p.id
         ), '[]'::json) AS comments
  FROM posts p`

// GET /api/posts — full feed, pinned first then newest. Auth optional (drives
// likedByMe/saved flags when present).
postsRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.sub ?? null
    const result = await query<PostRow>(
      `${POST_SELECT} ORDER BY p.pinned DESC, p.created_at DESC`,
      [uid],
    )
    res.json(result.rows.map(mapPost))
  }),
)

const createSchema = z.object({
  type: z.enum(['Update', 'Hiring', 'Open to Work', 'Mentorship', 'StartupVarsity']).default('Update'),
  content: z.string().trim().min(1, 'content is required'),
  image: z.string().optional(),
  visibility: z.enum(['All Alumni', 'My Network', 'Specific Community']).default('All Alumni'),
  communityId: z.string().optional(),
  domain: z.string().optional(),
  city: z.string().optional(),
  batch: z.number().int().optional(),
  role: z.string().optional(),
  company: z.string().optional(),
  // Hiring only: what the poster wants every applicant to answer.
  questions: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  // Hiring only: require applicants to attach a resume.
  wantsResume: z.boolean().optional(),
})

// POST /api/posts — create a post authored by the current user.
postsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const p = parsed.data
    const questions = p.type === 'Hiring' ? (p.questions ?? []) : []
    const wantsResume = p.type === 'Hiring' && !!p.wantsResume

    const inserted = await query<{ id: string }>(
      `INSERT INTO posts (author_id, type, content, image, visibility, community_id,
                          domain, city, batch, role, company, questions, wants_resume)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        req.user!.sub, p.type, p.content, p.image ?? null, p.visibility, p.communityId ?? null,
        p.domain ?? null, p.city ?? null, p.batch ?? null, p.role ?? null, p.company ?? null,
        JSON.stringify(questions), wantsResume,
      ],
    )
    // Job alert: tell alumni in the same domain about the new opening.
    if (p.type === 'Hiring' && p.domain) {
      const poster = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [req.user!.sub])
      const matches = await query<{ id: string }>(
        `SELECT id FROM users WHERE domain = $1 AND id <> $2 AND NOT is_admin`,
        [p.domain, req.user!.sub],
      )
      for (const m of matches.rows) {
        void pushNotification(
          m.id,
          'job',
          `New ${p.domain} job: ${p.role ?? 'open role'}${p.company ? ` at ${p.company}` : ''} — posted by ${poster.rows[0].name}.`,
          req.user!.sub,
        )
      }
    }

    // Re-select through the same projection so the response matches the feed shape.
    const full = await query<PostRow>(`${POST_SELECT} WHERE p.id = $2`, [req.user!.sub, inserted.rows[0].id])
    res.status(201).json(mapPost(full.rows[0]))
  }),
)

const editSchema = z.object({
  content: z.string().trim().min(1).optional(),
  role: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  domain: z.string().optional(),
  questions: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  wantsResume: z.boolean().optional(),
  // Hiring: FALSE closes the position (no new applications).
  active: z.boolean().optional(),
})

// PATCH /api/posts/:id — edit your own post (used by the Jobs page for Hiring
// posts: details, application questions, resume flag, open/closed status).
// Existing applications keep their own Q&A snapshot, so edits are always safe.
postsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await query<{ author_id: string; type: string }>(
      `SELECT author_id, type FROM posts WHERE id = $1`,
      [req.params.id],
    )
    if (!post.rowCount) throw new ApiError(404, 'Post not found')
    if (post.rows[0].author_id !== req.user!.sub) {
      throw new ApiError(403, 'You can only edit your own posts')
    }
    const parsed = editSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const patch = parsed.data
    const isHiring = post.rows[0].type === 'Hiring'

    const sets: string[] = []
    const params: unknown[] = []
    const add = (col: string, val: unknown) => {
      params.push(val)
      sets.push(`${col} = $${params.length}`)
    }
    if (patch.content !== undefined) add('content', patch.content)
    if (patch.role !== undefined) add('role', patch.role || null)
    if (patch.company !== undefined) add('company', patch.company || null)
    if (patch.city !== undefined) add('city', patch.city || null)
    if (patch.domain !== undefined) add('domain', patch.domain || null)
    if (isHiring && patch.questions !== undefined) add('questions', JSON.stringify(patch.questions))
    if (isHiring && patch.wantsResume !== undefined) add('wants_resume', patch.wantsResume)
    if (isHiring && patch.active !== undefined) add('active', patch.active)
    if (!sets.length) throw new ApiError(400, 'Nothing to update')

    params.push(req.params.id)
    await query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
    const full = await query<PostRow>(`${POST_SELECT} WHERE p.id = $2`, [req.user!.sub, req.params.id])
    res.json(mapPost(full.rows[0]))
  }),
)

async function ensurePostExists(id: string): Promise<void> {
  const exists = await query('SELECT 1 FROM posts WHERE id = $1', [id])
  if (!exists.rowCount) throw new ApiError(404, 'Post not found')
}

// POST /api/posts/:id/like — like (idempotent). Keeps the denormalised counter in sync.
postsRouter.post(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensurePostExists(req.params.id)
    const { likes, isNew } = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, req.user!.sub],
      )
      if (ins.rowCount) {
        await client.query(`UPDATE posts SET likes = likes + 1 WHERE id = $1`, [req.params.id])
      }
      const r = await client.query<{ likes: number }>(`SELECT likes FROM posts WHERE id = $1`, [req.params.id])
      return { likes: r.rows[0].likes, isNew: !!ins.rowCount }
    })
    // Notify the author on a fresh like (not on repeat toggles or self-likes).
    if (isNew) {
      const meta = await query<{ author_id: string; name: string }>(
        `SELECT p.author_id, u.name FROM posts p JOIN users u ON u.id = $2 WHERE p.id = $1`,
        [req.params.id, req.user!.sub],
      )
      const { author_id, name } = meta.rows[0]
      if (author_id !== req.user!.sub) {
        void pushNotification(author_id, 'like', `${name} liked your post.`, req.user!.sub)
      }
    }
    res.json({ likes, likedByMe: true })
  }),
)

// DELETE /api/posts/:id/like — unlike (idempotent).
postsRouter.delete(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensurePostExists(req.params.id)
    const likes = await withTransaction(async (client) => {
      const del = await client.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [
        req.params.id,
        req.user!.sub,
      ])
      if (del.rowCount) {
        await client.query(`UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1`, [req.params.id])
      }
      const r = await client.query<{ likes: number }>(`SELECT likes FROM posts WHERE id = $1`, [req.params.id])
      return r.rows[0].likes
    })
    res.json({ likes, likedByMe: false })
  }),
)

// POST /api/posts/:id/save — bookmark for the current user.
postsRouter.post(
  '/:id/save',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensurePostExists(req.params.id)
    await query(`INSERT INTO post_saves (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      req.params.id,
      req.user!.sub,
    ])
    res.json({ saved: true })
  }),
)

// DELETE /api/posts/:id/save — remove bookmark.
postsRouter.delete(
  '/:id/save',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensurePostExists(req.params.id)
    await query(`DELETE FROM post_saves WHERE post_id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.sub,
    ])
    res.json({ saved: false })
  }),
)

const commentSchema = z.object({ text: z.string().trim().min(1, 'comment text is required') })

// POST /api/posts/:id/comments — add a comment, returns the created comment.
postsRouter.post(
  '/:id/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensurePostExists(req.params.id)
    const parsed = commentSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)

    const result = await query<CommentRow>(
      `INSERT INTO comments (post_id, author_id, text) VALUES ($1, $2, $3)
       RETURNING id, author_id, text, created_at`,
      [req.params.id, req.user!.sub, parsed.data.text],
    )
    const meta = await query<{ author_id: string; name: string }>(
      `SELECT p.author_id, u.name FROM posts p JOIN users u ON u.id = $2 WHERE p.id = $1`,
      [req.params.id, req.user!.sub],
    )
    const { author_id, name } = meta.rows[0]
    if (author_id !== req.user!.sub) {
      void pushNotification(author_id, 'comment', `${name} commented on your post.`, req.user!.sub)
    }
    res.status(201).json(mapComment(result.rows[0]))
  }),
)

// POST /api/posts/:id/apply — apply to a Hiring post. Idempotent; notifies the
// poster on a fresh application. When the post carries application questions,
// an answer for every question is required.
postsRouter.post(
  '/:id/apply',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const post = await query<{
      author_id: string
      type: string
      role: string | null
      questions: string[]
      wants_resume: boolean
      active: boolean
    }>(`SELECT author_id, type, role, questions, wants_resume, active FROM posts WHERE id = $1`, [
      req.params.id,
    ])
    if (!post.rowCount) throw new ApiError(404, 'Post not found')
    const { author_id, type, role, questions, wants_resume, active } = post.rows[0]
    if (type !== 'Hiring') throw new ApiError(400, 'You can only apply to Hiring posts')
    if (author_id === me) throw new ApiError(400, 'You cannot apply to your own job post')
    if (!active) throw new ApiError(400, 'This position is closed and no longer accepting applications.')

    const answers: unknown = req.body?.answers ?? []
    if (
      !Array.isArray(answers) ||
      answers.some((a) => typeof a !== 'string' || a.length > 1000)
    ) {
      throw new ApiError(400, 'answers must be an array of strings')
    }
    if (questions.length > 0) {
      const trimmed = answers.map((a) => (a as string).trim())
      if (trimmed.length !== questions.length || trimmed.some((a) => !a)) {
        throw new ApiError(400, 'Please answer every question from the job poster.')
      }
    }

    // Resume attachment — required when the post asks for one.
    const RESUME_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    const resume = req.body?.resume as
      | { name?: unknown; dataBase64?: unknown; mediaType?: unknown }
      | undefined
    let resumeName: string | null = null
    let resumeType: string | null = null
    let resumeData: Buffer | null = null
    if (resume) {
      if (
        typeof resume.name !== 'string' ||
        typeof resume.dataBase64 !== 'string' ||
        typeof resume.mediaType !== 'string' ||
        !RESUME_TYPES.includes(resume.mediaType)
      ) {
        throw new ApiError(400, 'Resume must be a PDF or .docx file.')
      }
      // ~5MB file ≈ 6.7M base64 chars.
      if (resume.dataBase64.length > 7_000_000) {
        throw new ApiError(413, 'Resume is too large — please keep it under 5MB.')
      }
      resumeName = resume.name.slice(0, 200)
      resumeType = resume.mediaType
      resumeData = Buffer.from(resume.dataBase64.replace(/\s/g, ''), 'base64')
      if (!resumeData.length) throw new ApiError(400, 'Resume file was empty — please re-attach it.')
    }
    if (wants_resume && !resumeData) {
      throw new ApiError(400, 'This job requires a resume — please attach one to apply.')
    }

    // Snapshot question+answer pairs so later edits to the post's questions
    // can never mis-label what an applicant actually answered.
    const answerPairs = questions.map((q, i) => ({ q, a: (answers[i] as string).trim() }))

    const ins = await query(
      `INSERT INTO job_applications (post_id, applicant_id, answers, resume_name, resume_type, resume_data)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [req.params.id, me, JSON.stringify(answerPairs), resumeName, resumeType, resumeData],
    )
    if (ins.rowCount) {
      const meRow = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
      void pushNotification(
        author_id,
        'job',
        `${meRow.rows[0].name} applied to your job post${role ? ` for "${role}"` : ''}.`,
        me,
      )
    }
    const count = await query<{ count: number }>(
      `SELECT count(*)::int AS count FROM job_applications WHERE post_id = $1`,
      [req.params.id],
    )
    res.status(ins.rowCount ? 201 : 200).json({ applied: true, applicantsCount: count.rows[0].count })
  }),
)

// GET /api/posts/:id/applicants — who applied. Only the job poster may view.
postsRouter.get(
  '/:id/applicants',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await query<{ author_id: string }>(`SELECT author_id FROM posts WHERE id = $1`, [
      req.params.id,
    ])
    if (!post.rowCount) throw new ApiError(404, 'Post not found')
    if (post.rows[0].author_id !== req.user!.sub) {
      throw new ApiError(403, 'Only the poster can view applicants')
    }
    const result = await query<{
      id: string
      name: string
      photo: string | null
      designation: string
      company: string
      city: string
      answers: Array<{ q: string; a: string } | string>
      resume_name: string | null
      created_at: Date
    }>(
      `SELECT u.id, u.name, u.photo, u.designation, u.company, u.city, ja.answers, ja.resume_name, ja.created_at
       FROM job_applications ja JOIN users u ON u.id = ja.applicant_id
       WHERE ja.post_id = $1 ORDER BY ja.created_at DESC`,
      [req.params.id],
    )
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        photo: r.photo,
        designation: r.designation,
        company: r.company,
        city: r.city,
        answers: (r.answers ?? []).map((entry, i) =>
          typeof entry === 'string' ? { q: `Question ${i + 1}`, a: entry } : entry,
        ),
        resumeName: r.resume_name,
        appliedAt: new Date(r.created_at).toISOString(),
      })),
    )
  }),
)

// GET /api/posts/:id/applicants/:applicantId/resume — download an applicant's
// attached resume. Only the job poster may fetch it.
postsRouter.get(
  '/:id/applicants/:applicantId/resume',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await query<{ author_id: string }>(`SELECT author_id FROM posts WHERE id = $1`, [
      req.params.id,
    ])
    if (!post.rowCount) throw new ApiError(404, 'Post not found')
    if (post.rows[0].author_id !== req.user!.sub) {
      throw new ApiError(403, 'Only the poster can download resumes')
    }
    const r = await query<{ resume_name: string | null; resume_type: string | null; resume_data: Buffer | null }>(
      `SELECT resume_name, resume_type, resume_data FROM job_applications
       WHERE post_id = $1 AND applicant_id = $2`,
      [req.params.id, req.params.applicantId],
    )
    const row = r.rows[0]
    if (!row?.resume_data) throw new ApiError(404, 'This applicant did not attach a resume')
    res.setHeader('Content-Type', row.resume_type ?? 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(row.resume_name ?? 'resume').replace(/[^\w.\- ]/g, '_')}"`,
    )
    res.send(row.resume_data)
  }),
)

// POST /api/posts/:id/unpin — admin-only: retire an announcement from the top
// of feeds (the post itself remains in history).
postsRouter.post(
  '/:id/unpin',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const upd = await query(`UPDATE posts SET pinned = FALSE WHERE id = $1 AND pinned`, [req.params.id])
    if (!upd.rowCount) throw new ApiError(404, 'No pinned post with this id')
    res.json({ ok: true })
  }),
)

const announceSchema = z.object({
  text: z.string().trim().min(1, 'text is required'),
  // true → pinned announcement + broadcast notification; false → quiet news
  // update (shows on News & the feed, no pin, no notification blast).
  pin: z.boolean().default(true),
})

// POST /api/posts/announce — admin-only: publish official Rooman content.
postsRouter.post(
  '/announce',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = announceSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { text, pin } = parsed.data

    const inserted = await query<{ id: string }>(
      `INSERT INTO posts (author_id, type, content, visibility, pinned)
       VALUES ($1, 'Update', $2, 'All Alumni', $3) RETURNING id`,
      [req.user!.sub, text, pin],
    )
    if (pin) {
      void pushNotificationToAll('announcement', `📢 Rooman: ${text}`, req.user!.sub)
    }

    const full = await query<PostRow>(`${POST_SELECT} WHERE p.id = $2`, [req.user!.sub, inserted.rows[0].id])
    res.status(201).json(mapPost(full.rows[0]))
  }),
)
