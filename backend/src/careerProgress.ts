/**
 * What counts as "done" on a career roadmap.
 *
 * Deliberately mirrors frontend/src/lib/careerProgress.ts. The two apps build
 * separately and cannot share a module, so the definition exists twice and has
 * to stay in step. When it drifted, the timeline congratulated a member on a
 * finished roadmap while the badge engine still counted it unfinished and the
 * crimson 'goal_reached' badge could never be earned at all — that is the bug
 * this module exists to stop recurring.
 */

export interface RoadmapStageLike {
  stepKey?: string
  status?: string
}

/**
 * The stages a member can actually tick off.
 *
 * The first stage is the "you are here" marker and the last is the goal
 * itself. Neither has a completion control in the timeline, so neither can
 * ever be marked done — counting them in the total is what made "completed
 * every stage" unreachable. A plan of fewer than three stages therefore holds
 * no workable stage at all.
 */
export function workableStages<T extends RoadmapStageLike>(stages: T[]): T[] {
  return stages.length >= 3 ? stages.slice(1, -1) : []
}

/**
 * How many workable stages are finished, out of how many there are.
 *
 * A stage's effective status is its career_roadmap_step_state row when one
 * exists and otherwise the status the roadmap JSON was generated with — the
 * same merge loadActiveRoadmap does on read, and the same rule
 * career.routes.ts enforces when completing stages in order. Honouring the
 * saved row in both directions matters: a stage the member reopened must stop
 * counting, not keep its generated 'completed'.
 */
export function roadmapCompletion(
  stages: RoadmapStageLike[],
  savedStatusByKey: Map<string, string>,
): { total: number; completed: number } {
  const workable = workableStages(stages)
  const completed = workable.filter(
    (s) => (savedStatusByKey.get(String(s.stepKey)) ?? s.status) === 'completed',
  ).length
  return { total: workable.length, completed }
}
