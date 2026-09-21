import { query } from './db/pool.js'
import { pushNotification } from './notify.js'

/**
 * Profile stats and badges, derived from sessions BOTH parties confirmed.
 *
 * Mutual confirmation is the whole point. A count either side could inflate
 * on its own would be worthless as a signal, and these numbers are public on
 * a profile — so nothing here reads a self-reported field. A session that one
 * side marked done and the other never acknowledged contributes nothing.
 *
 * It is also the platform's answer to sessions drifting off-platform: the
 * record here is the thing a mentor loses by arranging privately, because it
 * is what ranks them in Career Guidance and what a student can point at.
 */

export interface BadgeDef {
  id: string
  side: 'mentor' | 'learner'
  name: string
  description: string
}

export const BADGES: BadgeDef[] = [
  { id: 'first_session_given', side: 'mentor', name: 'First Session', description: 'Mentored your first student' },
  { id: 'ten_sessions_given', side: 'mentor', name: '10 Sessions', description: 'Completed 10 mentorship sessions' },
  { id: 'fifty_sessions_given', side: 'mentor', name: '50 Sessions', description: 'Completed 50 mentorship sessions' },
  { id: 'ten_hours_given', side: 'mentor', name: '10 Hours', description: 'Given 10 hours of mentorship' },
  { id: 'fifty_hours_given', side: 'mentor', name: '50 Hours', description: 'Given 50 hours of mentorship' },
  { id: 'top_rated', side: 'mentor', name: 'Top Rated', description: '4.5+ average across 5 or more rated sessions' },
  { id: 'consistent_mentor', side: 'mentor', name: 'Consistent', description: 'Mentored in 4 consecutive weeks' },

  { id: 'first_session_taken', side: 'learner', name: 'First Session', description: 'Took your first mentorship session' },
  { id: 'five_sessions_taken', side: 'learner', name: 'Committed Learner', description: 'Took 5 mentorship sessions' },
  { id: 'ten_hours_learned', side: 'learner', name: '10 Hours Learned', description: 'Spent 10 hours in mentorship' },
  { id: 'roadmap_started', side: 'learner', name: 'Roadmap Started', description: 'Built a career roadmap' },
  { id: 'roadmap_halfway', side: 'learner', name: 'Halfway There', description: 'Completed half your roadmap' },
  { id: 'goal_reached', side: 'learner', name: 'Goal Reached', description: 'Completed every stage of your roadmap' },
  { id: 'consistent_learner', side: 'learner', name: 'On A Streak', description: 'Learned in 4 consecutive weeks' },
]

const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]))

export interface ProfileStats {
  sessionsGiven: number
  sessionsTaken: number
  hoursGiven: number
  hoursTaken: number
  avgRating: number | null
  ratingCount: number
  /** Consecutive weeks, counting back from this week, with a confirmed session. */
  mentorStreakWeeks: number
  learnerStreakWeeks: number
  roadmapProgress: { total: number; completed: number } | null
  badges: { id: string; name: string; description: string; side: string; earnedAt: string }[]
}

/** Consecutive ISO weeks with at least one confirmed session, counting back
 *  from the current week. The current week not having one yet does not break
 *  a streak — otherwise every streak would read zero until someone booked
 *  again on a Monday. */
async function streakWeeks(userId: string, column: 'mentor_id' | 'mentee_id'): Promise<number> {
  const rows = await query<{ wk: string }>(
    `SELECT DISTINCT date_trunc('week', confirmed_at) AS wk
       FROM mentorship_sessions
      WHERE ${column} = $1 AND confirmed_at IS NOT NULL
      ORDER BY wk DESC LIMIT 52`,
    [userId],
  )
  if (!rows.rowCount) return 0

  const weeks = rows.rows.map((r) => new Date(r.wk).getTime())
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const thisWeek = new Date()
  thisWeek.setHours(0, 0, 0, 0)
  thisWeek.setDate(thisWeek.getDate() - ((thisWeek.getDay() + 6) % 7))

  let expected = thisWeek.getTime()
  if (weeks[0] < expected) expected -= WEEK // allow the current week to be empty
  let streak = 0
  for (const w of weeks) {
    if (Math.abs(w - expected) < WEEK / 2) {
      streak++
      expected -= WEEK
    } else if (w < expected) break
  }
  return streak
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const totals = await query<{
    given: number; taken: number; mins_given: number | null; mins_taken: number | null
  }>(
    `SELECT
       count(*) FILTER (WHERE mentor_id = $1)::int AS given,
       count(*) FILTER (WHERE mentee_id = $1)::int AS taken,
       COALESCE(sum(duration_minutes) FILTER (WHERE mentor_id = $1), 0)::int AS mins_given,
       COALESCE(sum(duration_minutes) FILTER (WHERE mentee_id = $1), 0)::int AS mins_taken
     FROM mentorship_sessions
     WHERE confirmed_at IS NOT NULL AND (mentor_id = $1 OR mentee_id = $1)`,
    [userId],
  )
  const t = totals.rows[0]

  const rating = await query<{ avg: string | null; n: number }>(
    `SELECT round(avg(rating)::numeric, 1)::text AS avg, count(*)::int AS n
       FROM mentorship_sessions WHERE mentor_id = $1 AND rating IS NOT NULL`,
    [userId],
  )

  const roadmap = await query<{ data: unknown }>(
    `SELECT data FROM career_roadmaps WHERE user_id = $1 AND status = 'active'`,
    [userId],
  )
  let roadmapProgress: ProfileStats['roadmapProgress'] = null
  if (roadmap.rowCount) {
    const stages = ((roadmap.rows[0].data as { stages?: { stepKey?: string }[] })?.stages ?? [])
    const done = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM career_roadmap_step_state st
         JOIN career_roadmaps r ON r.id = st.roadmap_id
        WHERE r.user_id = $1 AND r.status = 'active' AND st.status = 'completed'`,
      [userId],
    )
    roadmapProgress = { total: stages.length, completed: done.rows[0]?.n ?? 0 }
  }

  const badgeRows = await query<{ badge: string; side: string; earned_at: Date | string }>(
    `SELECT badge, side, earned_at FROM profile_badges WHERE user_id = $1 ORDER BY earned_at`,
    [userId],
  )

  return {
    sessionsGiven: t?.given ?? 0,
    sessionsTaken: t?.taken ?? 0,
    hoursGiven: Math.round(((t?.mins_given ?? 0) / 60) * 10) / 10,
    hoursTaken: Math.round(((t?.mins_taken ?? 0) / 60) * 10) / 10,
    avgRating: rating.rows[0]?.avg ? Number(rating.rows[0].avg) : null,
    ratingCount: rating.rows[0]?.n ?? 0,
    mentorStreakWeeks: await streakWeeks(userId, 'mentor_id'),
    learnerStreakWeeks: await streakWeeks(userId, 'mentee_id'),
    roadmapProgress,
    badges: badgeRows.rows.map((b) => ({
      id: b.badge,
      name: BADGE_BY_ID.get(b.badge)?.name ?? b.badge,
      description: BADGE_BY_ID.get(b.badge)?.description ?? '',
      side: b.side,
      earnedAt: new Date(b.earned_at).toISOString(),
    })),
  }
}

/** Award whatever the member has newly qualified for. Inserting with ON
 *  CONFLICT DO NOTHING and notifying only on a real insert means this is
 *  safe to call as often as we like — a badge is announced exactly once. */
export async function refreshBadges(userId: string): Promise<string[]> {
  const s = await getProfileStats(userId)
  const earned: string[] = []

  const want: [string, boolean][] = [
    ['first_session_given', s.sessionsGiven >= 1],
    ['ten_sessions_given', s.sessionsGiven >= 10],
    ['fifty_sessions_given', s.sessionsGiven >= 50],
    ['ten_hours_given', s.hoursGiven >= 10],
    ['fifty_hours_given', s.hoursGiven >= 50],
    ['top_rated', s.ratingCount >= 5 && (s.avgRating ?? 0) >= 4.5],
    ['consistent_mentor', s.mentorStreakWeeks >= 4],
    ['first_session_taken', s.sessionsTaken >= 1],
    ['five_sessions_taken', s.sessionsTaken >= 5],
    ['ten_hours_learned', s.hoursTaken >= 10],
    ['roadmap_started', s.roadmapProgress !== null],
    ['roadmap_halfway', !!s.roadmapProgress && s.roadmapProgress.total > 0 &&
      s.roadmapProgress.completed / s.roadmapProgress.total >= 0.5],
    ['goal_reached', !!s.roadmapProgress && s.roadmapProgress.total > 0 &&
      s.roadmapProgress.completed >= s.roadmapProgress.total],
    ['consistent_learner', s.learnerStreakWeeks >= 4],
  ]

  for (const [id, qualified] of want) {
    if (!qualified) continue
    const def = BADGE_BY_ID.get(id)
    if (!def) continue
    const ins = await query(
      `INSERT INTO profile_badges (user_id, badge, side) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge) DO NOTHING`,
      [userId, id, def.side],
    )
    if (ins.rowCount) {
      earned.push(id)
      void pushNotification(userId, 'mentorship', `Badge earned: ${def.name} — ${def.description}`)
    }
  }
  return earned
}

/** Called once both sides have confirmed a session. Stamps confirmed_at,
 *  which is what every stat above counts, then refreshes both profiles. */
export async function recordConfirmedSession(sessionId: string): Promise<void> {
  const r = await query<{ mentor_id: string; mentee_id: string; both: boolean }>(
    `UPDATE mentorship_sessions
        SET confirmed_at = COALESCE(confirmed_at, now())
      WHERE id = $1 AND mentee_confirmed AND mentor_confirmed
      RETURNING mentor_id, mentee_id, TRUE AS both`,
    [sessionId],
  )
  if (!r.rowCount) return
  await refreshBadges(r.rows[0].mentor_id)
  await refreshBadges(r.rows[0].mentee_id)
}
