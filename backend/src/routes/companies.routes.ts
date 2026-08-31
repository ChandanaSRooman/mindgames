import { Router } from 'express'
import { query } from '../db/pool.js'
import { requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { mapCompany, mapCompanyAlumnus, type CompanyAlumnusRow, type CompanyRow } from '../mappers.js'

export const companiesRouter = Router()

async function ensureCompanyExists(
  id: string,
): Promise<{ id: string; name: string; domain: string | null; industry: string }> {
  const found = await query<{ id: string; name: string; domain: string | null; industry: string }>(
    'SELECT id, name, domain, industry FROM companies WHERE id = $1',
    [id],
  )
  if (!found.rowCount) throw new ApiError(404, 'Company not found')
  return found.rows[0]
}

// GET /api/companies — the directory: every company, alumni count, and a
// 4-avatar preview for the overlapping-avatars card. Alumni are matched by
// comparing users.company to companies.name case/whitespace-insensitively.
companiesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = (
      await query<CompanyRow>(
        `SELECT c.id, c.name, c.domain, c.industry,
                COUNT(u.id)::int AS alumni_count,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'photo', p.photo))
                   FROM (
                     SELECT u2.id, u2.name, u2.photo FROM users u2
                     WHERE LOWER(TRIM(u2.company)) = LOWER(c.name)
                     ORDER BY u2.name LIMIT 4
                   ) p
                  ), '[]'
                ) AS preview_alumni,
                EXISTS (
                  SELECT 1 FROM company_saves cs WHERE cs.company_id = c.id AND cs.user_id = $1
                ) AS saved_by_me
         FROM companies c
         LEFT JOIN users u ON LOWER(TRIM(u.company)) = LOWER(c.name)
         GROUP BY c.id
         ORDER BY alumni_count DESC, c.name`,
        [req.user!.sub],
      )
    ).rows
    res.json(rows.map(mapCompany))
  }),
)

// GET /api/companies/:id — company header + the full matched-alumni list,
// each with a mutual-connections count relative to the current user.
companiesRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.sub
    const company = await ensureCompanyExists(req.params.id)

    const alumni = (
      await query<CompanyAlumnusRow>(
        `WITH my_conns AS (
           SELECT CASE WHEN requester_id = $2 THEN addressee_id ELSE requester_id END AS uid
           FROM connections WHERE status = 'accepted' AND (requester_id = $2 OR addressee_id = $2)
         )
         SELECT u.id, u.name, u.photo,
                u.designation AS role, u.city AS location, u.bio AS journey,
                (
                  SELECT count(*)::int FROM connections c
                  WHERE c.status = 'accepted' AND (c.requester_id = u.id OR c.addressee_id = u.id)
                    AND (CASE WHEN c.requester_id = u.id THEN c.addressee_id ELSE c.requester_id END)
                        IN (SELECT uid FROM my_conns)
                ) AS mutual_connections
         FROM users u
         WHERE LOWER(TRIM(u.company)) = LOWER($1) AND u.id <> $2
         ORDER BY u.name`,
        [company.name, me],
      )
    ).rows

    const savedByMe = await query(
      `SELECT 1 FROM company_saves WHERE company_id = $1 AND user_id = $2`,
      [company.id, me],
    )

    res.json({
      ...mapCompany({
        ...company,
        alumni_count: alumni.length,
        preview_alumni: null,
        saved_by_me: !!savedByMe.rowCount,
      }),
      alumni: alumni.map(mapCompanyAlumnus),
    })
  }),
)

// POST /api/companies/:id/save — bookmark for the current user.
companiesRouter.post(
  '/:id/save',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensureCompanyExists(req.params.id)
    await query(
      `INSERT INTO company_saves (company_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user!.sub],
    )
    res.json({ saved: true })
  }),
)

// DELETE /api/companies/:id/save — remove bookmark.
companiesRouter.delete(
  '/:id/save',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensureCompanyExists(req.params.id)
    await query(`DELETE FROM company_saves WHERE company_id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.sub,
    ])
    res.json({ saved: false })
  }),
)
