import type { CareerResource, CareerStage } from '../types'

/**
 * Grouping learning resources under the roadmap stage they belong to.
 *
 * Pure on purpose: the Resources page and anything later that summarises it
 * have to agree on which stage a resource counts towards, and on what happens
 * to one whose stage no longer exists.
 */

export interface ResourceGroup {
  /** The stage these belong to, or null for the catch-all group. */
  stepKey: string | null
  title: string
  resources: CareerResource[]
}

/** Heading for resources that belong to no current stage. */
export const UNSORTED_TITLE = 'Other resources'

/**
 * A resource counts towards a stage only when it names **this** roadmap.
 *
 * A roadmap is regenerated as a new version row every time the member edits
 * their assessment, and step keys repeat across versions. Matching on stepKey
 * alone would silently re-file a resource saved against the old plan under a
 * same-named stage of the new one. Matching on the pair instead means an old
 * resource falls into the catch-all group — still visible, still the member's,
 * just no longer claiming to belong to a stage it was never saved against.
 */
export function belongsToStage(
  resource: CareerResource,
  roadmapId: string,
  stepKey: string,
): boolean {
  return resource.roadmapId === roadmapId && resource.stepKey === stepKey
}

/**
 * Resources grouped by stage, in the roadmap's own order, with anything left
 * over last.
 *
 * Empty stages are dropped rather than rendered as empty headings — adding a
 * resource is done from a button with a stage picker, so a wall of empty
 * groups would be noise rather than an affordance.
 */
export function groupByStage(
  resources: CareerResource[],
  stages: CareerStage[],
  roadmapId: string,
): ResourceGroup[] {
  const groups: ResourceGroup[] = []
  const claimed = new Set<string>()

  for (const stage of stages) {
    const mine = resources.filter((r) => belongsToStage(r, roadmapId, stage.stepKey))
    if (!mine.length) continue
    mine.forEach((r) => claimed.add(r.id))
    groups.push({ stepKey: stage.stepKey, title: stage.title, resources: mine })
  }

  const rest = resources.filter((r) => !claimed.has(r.id))
  if (rest.length) groups.push({ stepKey: null, title: UNSORTED_TITLE, resources: rest })

  return groups
}

/** How many of these are finished — used for the "3 of 7 done" line. */
export function doneCount(resources: CareerResource[]): number {
  return resources.filter((r) => r.status === 'done').length
}

/**
 * Whether this resource was shared with me rather than saved by me.
 *
 * Drives the "shared by X" label. It is a comparison against the viewer, not
 * a stored flag, because the same row is "mine" to its owner and "shared with
 * me" to the other party to the session.
 */
export function isSharedWithMe(resource: CareerResource, myUserId: string): boolean {
  return resource.userId !== myUserId
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * When a resource was assigned, relative to its session — "2d before
 * session", "3h after session". Null when the session has no real
 * timestamp (older sessions only carry display labels), so the caller can
 * fall back to the plain date instead of printing a guess.
 */
export function assignedRelativeToSession(assignedAt: string, sessionAt?: string): string | null {
  if (!sessionAt) return null
  const diff = +new Date(assignedAt) - +new Date(sessionAt)
  if (Number.isNaN(diff)) return null
  const gap = Math.abs(diff)
  if (gap < MINUTE) return 'at session time'
  const amount =
    gap >= DAY ? `${Math.floor(gap / DAY)}d` : gap >= HOUR ? `${Math.floor(gap / HOUR)}h` : `${Math.floor(gap / MINUTE)}m`
  return `${amount} ${diff < 0 ? 'before' : 'after'} session`
}

/** A short absolute date and time, e.g. "30 Sep, 11:40 am". */
export function shortStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}
