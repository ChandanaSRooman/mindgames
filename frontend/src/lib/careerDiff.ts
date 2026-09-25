import { CAREER_GOALS, SUPPORT_PREFERENCES } from '../types'
import type { CareerAssessment, CareerStageStatus } from '../types'
import type { CareerAssessmentInput } from './api'

/**
 * Before/after comparison for the two Career Guidance edit flows.
 *
 * Pure functions on purpose: editing a roadmap or retaking the assessment
 * should be able to say "here is exactly what you are about to change"
 * *before* anything is sent to the server, so neither of these touches the
 * network or React.
 */

export interface FieldChange {
  label: string
  before: string
  after: string
}

const EMPTY = '—'

function goalLabel(value: string): string {
  return CAREER_GOALS.find((g) => g.value === value)?.label || value || EMPTY
}

function supportLabel(value: string): string {
  return SUPPORT_PREFERENCES.find((s) => s.value === value)?.label || value || EMPTY
}

function textOf(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return EMPTY
  const s = String(value).trim()
  return s.length > 0 ? s : EMPTY
}

function listOf(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : EMPTY
}

/** Multi-select answers are stored in the order they were tapped, so two
 *  identical sets can differ as arrays. Compare them as sets, not sequences,
 *  or re-picking the same chips would report a change that isn't one. */
function sameSet(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false
  const left = new Set(a)
  return b.every((v) => left.has(v))
}

/**
 * What a re-taken assessment changes versus the last submitted one.
 * `prev` is null the first time through, which yields no rows — there is
 * nothing to compare a first answer against.
 */
export function diffAssessment(
  prev: CareerAssessment | null,
  next: CareerAssessmentInput,
): FieldChange[] {
  if (!prev) return []
  const changes: FieldChange[] = []

  const push = (label: string, before: string, after: string) => {
    if (before !== after) changes.push({ label, before, after })
  }

  push('Where you are now', textOf(prev.currentSituation), textOf(next.currentSituation))
  push('Goal', goalLabel(prev.goalType), goalLabel(next.goalType))
  push(
    'Target role',
    prev.targetRoleUnsure ? 'Still exploring' : textOf(prev.targetRole),
    next.targetRoleUnsure ? 'Still exploring' : textOf(next.targetRole),
  )
  push(
    'Hours per week',
    prev.hoursPerWeek ? `${prev.hoursPerWeek} hrs` : EMPTY,
    next.hoursPerWeek ? `${next.hoursPerWeek} hrs` : EMPTY,
  )
  push(
    'Timeline',
    prev.timelineMonths ? `${prev.timelineMonths} months` : EMPTY,
    next.timelineMonths ? `${next.timelineMonths} months` : EMPTY,
  )
  push('Skills note', textOf(prev.extraSkillsNote), textOf(next.extraSkillsNote))
  push('Support preference', supportLabel(prev.supportPreference), supportLabel(next.supportPreference))
  push('Anything else', textOf(prev.freeText), textOf(next.freeText))

  if (!sameSet(prev.learningPrefs, next.learningPrefs)) {
    changes.push({
      label: 'Ways of growing',
      before: listOf(prev.learningPrefs),
      after: listOf(next.learningPrefs),
    })
  }
  if (!sameSet(prev.helpTypes, next.helpTypes)) {
    changes.push({
      label: 'Help wanted',
      before: listOf(prev.helpTypes),
      after: listOf(next.helpTypes),
    })
  }

  return changes
}

export type StageChangeKind = 'added' | 'removed' | 'renamed' | 'moved' | 'duration' | 'status'

export interface StageChange {
  kind: StageChangeKind
  /** The stage this line is about, named as the member currently sees it. */
  stage: string
  before: string
  after: string
}

export interface ComparableStage {
  stepKey: string
  title: string
  status: CareerStageStatus
  durationWeeks: number | null
}

const STATUS_LABELS: Record<CareerStageStatus, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  completed: 'Completed',
  paused: 'Paused',
}

function weeksOf(weeks: number | null): string {
  return weeks === null || weeks === undefined ? 'No duration' : `${weeks} weeks`
}

/**
 * What an in-flight roadmap edit changes versus the saved plan.
 *
 * Stages are matched by `stepKey` rather than by position: position is
 * exactly what reordering changes, so matching on it would report every
 * stage below a move as renamed.
 */
export function diffRoadmap(prev: ComparableStage[], next: ComparableStage[]): StageChange[] {
  const changes: StageChange[] = []
  const prevByKey = new Map(prev.map((s) => [s.stepKey, s]))
  const nextByKey = new Map(next.map((s) => [s.stepKey, s]))
  const prevOrder = new Map(prev.map((s, i) => [s.stepKey, i]))

  for (const s of prev) {
    if (!nextByKey.has(s.stepKey)) {
      changes.push({ kind: 'removed', stage: s.title, before: 'In your plan', after: 'Removed' })
    }
  }

  next.forEach((s, i) => {
    const was = prevByKey.get(s.stepKey)
    if (!was) {
      changes.push({ kind: 'added', stage: s.title, before: 'Not in your plan', after: `Added at step ${i + 1}` })
      return
    }
    if (was.title !== s.title) {
      changes.push({ kind: 'renamed', stage: was.title, before: was.title, after: s.title })
    }
    if (was.durationWeeks !== s.durationWeeks) {
      changes.push({
        kind: 'duration',
        stage: s.title,
        before: weeksOf(was.durationWeeks),
        after: weeksOf(s.durationWeeks),
      })
    }
    if (was.status !== s.status) {
      changes.push({
        kind: 'status',
        stage: s.title,
        before: STATUS_LABELS[was.status] ?? was.status,
        after: STATUS_LABELS[s.status] ?? s.status,
      })
    }
    // Only report a move when the stage's position changed relative to the
    // stages that still exist — otherwise deleting step 1 would report every
    // remaining stage as "moved", which is noise, not a decision.
    const wasIndex = prevOrder.get(s.stepKey) ?? i
    const survivorsAbove = prev.filter(
      (p) => (prevOrder.get(p.stepKey) ?? 0) < wasIndex && nextByKey.has(p.stepKey),
    ).length
    if (survivorsAbove !== i) {
      changes.push({
        kind: 'moved',
        stage: s.title,
        before: `Step ${survivorsAbove + 1}`,
        after: `Step ${i + 1}`,
      })
    }
  })

  return changes
}
