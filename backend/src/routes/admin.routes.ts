import { Router } from 'express'
import { query } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { asyncHandler } from '../http.js'
import { config } from '../config.js'
import { emailEnabled } from '../email.js'
import { aiEnabled } from '../ai.js'

// Network-wide overview numbers for the admin console.
export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

// GET /api/admin/stats — one call, everything the dashboard shows.
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const one = async (sql: string): Promise<number> =>
      Number((await query<{ n: string }>(sql)).rows[0].n)

    const [
      members,
      membersThisWeek,
      invitees,
      invited,
      posts,
      comments,
      communities,
      sessionsUpcoming,
      sessionsRequested,
      sessionsCompleted,
      startups,
      pendingMentorApps,
      jobApplications,
      messages,
    ] = await Promise.all([
      one(`SELECT count(*) AS n FROM users WHERE NOT is_admin`),
      one(`SELECT count(*) AS n FROM users WHERE NOT is_admin AND created_at > now() - interval '7 days'`),
      one(`SELECT count(*) AS n FROM invitees`),
      one(`SELECT count(*) AS n FROM invitees WHERE invited_at IS NOT NULL`),
      one(`SELECT count(*) AS n FROM posts`),
      one(`SELECT count(*) AS n FROM comments`),
      one(`SELECT count(*) AS n FROM communities`),
      one(`SELECT count(*) AS n FROM mentorship_sessions WHERE status = 'upcoming'`),
      one(`SELECT count(*) AS n FROM mentorship_sessions WHERE status = 'requested'`),
      one(`SELECT count(*) AS n FROM mentorship_sessions WHERE status = 'past'`),
      one(`SELECT count(*) AS n FROM startups`),
      one(`SELECT count(*) AS n FROM mentor_applications WHERE status = 'pending'`),
      one(`SELECT count(*) AS n FROM job_applications`),
      one(`SELECT count(*) AS n FROM messages`),
    ])

    // Latest sign-ups so the admin can see who joined.
    const recent = await query<{ id: string; name: string; email: string; city: string; created_at: Date }>(
      `SELECT id, name, email, city, created_at FROM users
       WHERE NOT is_admin ORDER BY created_at DESC LIMIT 8`,
    )

    res.json({
      members,
      membersThisWeek,
      invitees,
      invited,
      posts,
      comments,
      communities,
      sessions: { upcoming: sessionsUpcoming, requested: sessionsRequested, completed: sessionsCompleted },
      startups,
      pendingMentorApps,
      jobApplications,
      messages,
      integrations: {
        google: !!config.googleClientId,
        smtp: emailEnabled,
        ai: aiEnabled,
      },
      recentMembers: recent.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        city: r.city,
        joinedAt: new Date(r.created_at).toISOString(),
      })),
    })
  }),
)
