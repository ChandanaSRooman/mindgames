import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'
import { mapCareerResource, mapPublicCareerResource, type CareerResourceRow } from '../mappers.js'

/**
 * Learning resources — the things a member is learning from on the way
 * through their roadmap.
 *
 * A resource is owned by whoever created it and can optionally name two
 * things, independently of each other:
 *
 *   - a roadmap stage, so the Resources page can group by stage
 *   - a mentorship session, which is how a mentor hands their mentee
 *     "read this before we meet", and how the mentee hands one back
 *
 * Visibility follows from the session link: you see a resource if you own it,
 * or if it is attached to a session you are a party to. That rule lives here
 * and not in schema.sql because it depends on who is asking.
 */
export const careerResourcesRouter = Router()

const KINDS = ['article', 'video', 'course', 'book', 'doc', 'other'] as const
const STATUSES = ['saved', 'in_progress', 'done'] as const

// Everything the caller may see: their own rows, plus anything attached to a
// session they are in. Written as one WHERE rather than two queries and a
// merge in JS, so ORDER BY (and any later paging) applies to the whole set.
const VISIBLE = `
  (r.user_id = $1
   OR (r.session_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM mentorship_sessions ms
          WHERE ms.id = r.session_id
            AND (ms.mentor_id = $1 OR ms.mentee_id = $1))))`

const SELECT = `
  SELECT r.*, u.name AS owner_name, u.photo AS owner_photo, s.topic AS session_topic
    FROM career_resources r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN mentorship_sessions s ON s.id = r.session_id`

/** Confirms the caller is the mentor or the mentee of this session.
 *
 *  Without it anyone could attach a row to any session id and have it appear
 *  in two strangers' lists. The session link is what grants visibility, so
 *  writing one has to be gated as tightly as reading one. */
async function assertInSession(sessionId: string, me: string) {
  const r = await query(
    `SELECT 1 FROM mentorship_sessions WHERE id = $1 AND (mentor_id = $2 OR mentee_id = $2)`,
    [sessionId, me],
  )
  if (!r.rowCount) throw new ApiError(404, 'Session not found (or you are not part of it)')
}

/** Confirms the roadmap is the caller's own and really has that stage.
 *
 *  Mirrors the step-key check the roadmap step-status route already does: an
 *  unchecked key would quietly file a resource under a stage that does not
 *  exist, which the Resources page could then never show. */
async function assertOwnStage(roadmapId: string, stepKey: string | undefined, me: string) {
  const r = await query<{ data: { stages?: { stepKey?: string }[] } | null }>(
    `SELECT data FROM career_roadmaps WHERE id = $1 AND user_id = $2`,
    [roadmapId, me],
  )
  if (!r.rowCount) throw new ApiError(404, 'Roadmap not found (or not yours)')
  if (stepKey === undefined) return
  const stages = r.rows[0].data?.stages ?? []
  if (!stages.some((s) => s.stepKey === stepKey)) {
    throw new ApiError(404, 'No such step in that roadmap')
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  url: z.string().trim().url().max(2000).optional(),
  note: z.string().trim().max(1000).optional(),
  kind: z.enum(KINDS).optional(),
  status: z.enum(STATUSES).optional(),
  roadmapId: z.string().optional(),
  stepKey: z.string().optional(),
  sessionId: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
})

// Spelled out rather than createSchema.partial(), for the reason documented on
// serviceUpdateSchema in career.routes.ts: .partial() keeps each field's
// .default(), so an absent field arrives as a value and overwrites the stored
// row instead of falling through to it.
const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  url: z.string().trim().url().max(2000).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  kind: z.enum(KINDS).optional(),
  status: z.enum(STATUSES).optional(),
  isPublic: z.boolean().optional(),
})

// GET /api/career-resources — everything I can see, newest first.
// `?sessionId=` narrows it to one session, which is what the session view uses.
careerResourcesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
    if (sessionId) await assertInSession(sessionId, req.user!.sub)

    const r = await query<CareerResourceRow>(
      `${SELECT} WHERE ${VISIBLE}${sessionId ? ' AND r.session_id = $2' : ''}
       ORDER BY r.created_at DESC`,
      sessionId ? [req.user!.sub, sessionId] : [req.user!.sub],
    )
    res.json(r.rows.map(mapCareerResource))
  }),
)

// GET /api/career-resources/of/:userId — the PUBLIC resources on someone
// else's profile. Deliberately separate from GET / (which is "my own
// dashboard": mine plus anything shared with me in a session) — mixing the
// two would mean a stranger's public recommendation showing up unannounced
// in your own resource list. Mounted before the '/:id' routes below, so
// Express does not try to match "of" as an id.
careerResourcesRouter.get(
  '/of/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query<CareerResourceRow>(
      `${SELECT} WHERE r.user_id = $1 AND r.is_public ORDER BY r.created_at DESC`,
      [req.params.userId],
    )
    res.json(r.rows.map(mapPublicCareerResource))
  }),
)

// POST /api/career-resources — save a resource, optionally against a stage
// and/or a session.
careerResourcesRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const d = parsed.data
    const me = req.user!.sub

    // A stage key only means something inside a roadmap, so one without the
    // other is a request that cannot be stored coherently.
    if (d.stepKey && !d.roadmapId) throw new ApiError(400, 'A stage needs its roadmap')
    if (d.roadmapId) await assertOwnStage(d.roadmapId, d.stepKey, me)
    if (d.sessionId) await assertInSession(d.sessionId, me)

    const ins = await query<{ id: string }>(
      `INSERT INTO career_resources (user_id, title, url, note, kind, status, roadmap_id, step_key, session_id, is_public)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'article'), COALESCE($6, 'saved'), $7, $8, $9, $10)
       RETURNING id`,
      [
        me, d.title, d.url ?? null, d.note ?? null, d.kind ?? null, d.status ?? null,
        d.roadmapId ?? null, d.stepKey ?? null, d.sessionId ?? null, d.isPublic,
      ],
    )

    // Sharing into a session is the one case where someone else gains a row
    // they did not create, so it is the one case worth a notification.
    if (d.sessionId) {
      const s = await query<{ mentor_id: string; mentee_id: string; topic: string }>(
        `SELECT mentor_id, mentee_id, topic FROM mentorship_sessions WHERE id = $1`,
        [d.sessionId],
      )
      const row = s.rows[0]
      const other = row.mentor_id === me ? row.mentee_id : row.mentor_id
      const who = await query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [me])
      void pushNotification(
        other,
        'mentorship',
        `${who.rows[0].name} shared "${d.title}" for your session "${row.topic}".`,
        me,
        { type: 'session', id: d.sessionId },
      )
    }

    const full = await query<CareerResourceRow>(`${SELECT} WHERE r.id = $1`, [ins.rows[0].id])
    res.status(201).json(mapCareerResource(full.rows[0]))
  }),
)

// PATCH /api/career-resources/:id — edit my own resource. The stage and
// session links are deliberately not editable: re-pointing a shared row would
// move it between people's lists without either of them acting.
careerResourcesRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const d = parsed.data

    const cur = await query<CareerResourceRow>(
      `SELECT * FROM career_resources WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.sub],
    )
    if (!cur.rowCount) throw new ApiError(404, 'Resource not found (or not yours)')
    const c = cur.rows[0]

    await query(
      `UPDATE career_resources
          SET title = $2, url = $3, note = $4, kind = $5, status = $6, is_public = $7, updated_at = now()
        WHERE id = $1`,
      [
        req.params.id,
        d.title ?? c.title,
        d.url === undefined ? c.url : d.url,
        d.note === undefined ? c.note : d.note,
        d.kind ?? c.kind,
        d.status ?? c.status,
        d.isPublic ?? c.is_public,
      ],
    )
    const full = await query<CareerResourceRow>(`${SELECT} WHERE r.id = $1`, [req.params.id])
    res.json(mapCareerResource(full.rows[0]))
  }),
)

// DELETE /api/career-resources/:id — only the owner. Someone a resource was
// shared with stops seeing it by leaving the session, not by deleting another
// member's row.
careerResourcesRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query(
      `DELETE FROM career_resources WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.sub],
    )
    if (!r.rowCount) throw new ApiError(404, 'Resource not found (or not yours)')
    res.status(204).end()
  }),
)
