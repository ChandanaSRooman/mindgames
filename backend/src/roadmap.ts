import { query } from './db/pool.js'
import { mapCareerRoadmap, type CareerRoadmapRow } from './mappers.js'

/** One stage as the roadmap JSON stores it, with its status already merged
 *  from career_roadmap_step_state. */
export interface LoadedStage {
  stepKey: string
  title: string
  status: string
  durationWeeks?: number | null
  relevantAlumniIds?: string[]
  relevantServiceIds?: string[]
  [key: string]: unknown
}

export type LoadedRoadmap = ReturnType<typeof mapCareerRoadmap> & { stages: LoadedStage[] }

/**
 * A member's active roadmap with each stage's live status, and nothing else.
 *
 * Two indexed reads: the one active roadmap (a unique partial index on
 * user_id), then its handful of step-state rows. Split out of
 * career.routes.ts's loadActiveRoadmap, which adds the matched services with
 * their providers' photos on top — the Learning Resources page needs only the
 * plan, and those photos are the heaviest part of that response.
 */
export async function loadRoadmapCore(userId: string): Promise<LoadedRoadmap | null> {
  const r = await query<CareerRoadmapRow>(
    `SELECT * FROM career_roadmaps WHERE user_id = $1 AND status = 'active'`,
    [userId],
  )
  if (!r.rowCount) return null
  const mapped = mapCareerRoadmap(r.rows[0])
  const states = await query<{ step_key: string; status: string }>(
    `SELECT step_key, status FROM career_roadmap_step_state WHERE roadmap_id = $1`,
    [r.rows[0].id],
  )
  const byKey = new Map(states.rows.map((s) => [s.step_key, s.status]))
  // The same merge career.routes.ts always did: the saved state when there is
  // one, else what the roadmap was generated with. Nothing else is coerced, so
  // the Career Guidance response is byte-for-byte what it was before.
  const stages = (mapped.stages as Record<string, unknown>[]).map((s) => ({
    ...s,
    status: byKey.get(String(s.stepKey)) ?? s.status,
  })) as LoadedStage[]
  return { ...mapped, stages }
}
