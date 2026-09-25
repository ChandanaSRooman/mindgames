// Sanity checks for the Career Guidance before/after diffs. Run with:
//   npm --prefix frontend run check
import assert from 'node:assert'
import { diffAssessment, diffRoadmap, type ComparableStage } from './careerDiff'
import type { CareerAssessment } from '../types'
import type { CareerAssessmentInput } from './api'

// --- assessment -------------------------------------------------------------

const prevAssessment: CareerAssessment = {
  id: 'a1',
  status: 'submitted',
  currentSituation: 'Fresher',
  goalType: 'first_job',
  targetRole: 'Backend Engineer',
  targetRoleUnsure: false,
  hoursPerWeek: 10,
  timelineMonths: 6,
  extraSkillsNote: '',
  learningPrefs: ['Courses', 'Mentorship'],
  supportPreference: 'free_only',
  helpTypes: ['resume_review'],
  freeText: '',
  createdAt: '',
  updatedAt: '',
}

const asInput = (a: CareerAssessment): CareerAssessmentInput => ({
  currentSituation: a.currentSituation,
  goalType: a.goalType,
  targetRole: a.targetRole,
  targetRoleUnsure: a.targetRoleUnsure,
  hoursPerWeek: a.hoursPerWeek,
  timelineMonths: a.timelineMonths,
  extraSkillsNote: a.extraSkillsNote,
  learningPrefs: a.learningPrefs,
  supportPreference: a.supportPreference,
  helpTypes: a.helpTypes,
  freeText: a.freeText,
})

// Identical answers are not a change.
assert.deepStrictEqual(diffAssessment(prevAssessment, asInput(prevAssessment)), [])

// A first-ever assessment has nothing to compare against.
assert.deepStrictEqual(diffAssessment(null, asInput(prevAssessment)), [])

// Re-picking the same multi-select chips in a different order is not a change.
assert.deepStrictEqual(
  diffAssessment(prevAssessment, {
    ...asInput(prevAssessment),
    learningPrefs: ['Mentorship', 'Courses'],
  }),
  [],
)

// Values are reported with their human labels, not their raw enum values.
const goalChange = diffAssessment(prevAssessment, {
  ...asInput(prevAssessment),
  goalType: 'switch_career',
})
assert.strictEqual(goalChange.length, 1)
assert.deepStrictEqual(goalChange[0], {
  label: 'Goal',
  before: 'Get my first job',
  after: 'Switch career',
})

// Ticking "not sure yet" reads as an intent, not as an emptied text field.
const unsure = diffAssessment(prevAssessment, {
  ...asInput(prevAssessment),
  targetRole: '',
  targetRoleUnsure: true,
})
assert.deepStrictEqual(unsure, [
  { label: 'Target role', before: 'Backend Engineer', after: 'Still exploring' },
])

// Several edits at once are all reported.
const many = diffAssessment(prevAssessment, {
  ...asInput(prevAssessment),
  hoursPerWeek: 20,
  timelineMonths: 12,
  helpTypes: ['mock_interview'],
})
assert.strictEqual(many.length, 3)

// --- roadmap ----------------------------------------------------------------

const plan: ComparableStage[] = [
  { stepKey: 's1', title: 'Foundations', status: 'in_progress', durationWeeks: 4 },
  { stepKey: 's2', title: 'Projects', status: 'upcoming', durationWeeks: 6 },
  { stepKey: 's3', title: 'Interviews', status: 'upcoming', durationWeeks: 4 },
]

// An untouched plan reports nothing, so "Save" stays disabled.
assert.deepStrictEqual(diffRoadmap(plan, plan), [])

// A rename is a rename, not a remove-plus-add: stages match on stepKey.
const renamed = diffRoadmap(plan, [{ ...plan[0], title: 'Basics' }, plan[1], plan[2]])
assert.deepStrictEqual(renamed, [
  { kind: 'renamed', stage: 'Foundations', before: 'Foundations', after: 'Basics' },
])

// Duration and status changes are reported separately and in human terms.
const retimed = diffRoadmap(plan, [{ ...plan[0], durationWeeks: 8, status: 'paused' }, plan[1], plan[2]])
assert.deepStrictEqual(retimed, [
  { kind: 'duration', stage: 'Foundations', before: '4 weeks', after: '8 weeks' },
  { kind: 'status', stage: 'Foundations', before: 'In progress', after: 'Paused' },
])

// Clearing a duration reads as "No duration" rather than an empty string.
const cleared = diffRoadmap(plan, [{ ...plan[0], durationWeeks: null }, plan[1], plan[2]])
assert.deepStrictEqual(cleared, [
  { kind: 'duration', stage: 'Foundations', before: '4 weeks', after: 'No duration' },
])

// Swapping two stages reports exactly the two that moved.
const swapped = diffRoadmap(plan, [plan[1], plan[0], plan[2]])
assert.deepStrictEqual(swapped, [
  { kind: 'moved', stage: 'Projects', before: 'Step 2', after: 'Step 1' },
  { kind: 'moved', stage: 'Foundations', before: 'Step 1', after: 'Step 2' },
])

// Deleting the first stage must NOT report the survivors as "moved" — they
// kept their relative order, and reporting them would bury the real change.
const deletedFirst = diffRoadmap(plan, [plan[1], plan[2]])
assert.deepStrictEqual(deletedFirst, [
  { kind: 'removed', stage: 'Foundations', before: 'In your plan', after: 'Removed' },
])

// A brand new stage is reported with the position it lands in — and the stage
// it displaces is reported as moved, because its position really did change.
const added: ComparableStage = {
  stepKey: 'custom-1',
  title: 'Open source',
  status: 'upcoming',
  durationWeeks: 3,
}
const withAdded = diffRoadmap(plan, [plan[0], plan[1], added, plan[2]])
assert.deepStrictEqual(withAdded, [
  { kind: 'added', stage: 'Open source', before: 'Not in your plan', after: 'Added at step 3' },
  { kind: 'moved', stage: 'Interviews', before: 'Step 3', after: 'Step 4' },
])

// Stages above the insertion point are untouched, so they are not reported.
assert.strictEqual(withAdded.filter((c) => c.stage === 'Foundations').length, 0)
assert.strictEqual(withAdded.filter((c) => c.stage === 'Projects').length, 0)

// Adding a stage in the middle pushes the one below it down, and that IS a
// real move the member should see.
const insertedEarly = diffRoadmap(plan, [added, plan[0], plan[1], plan[2]])
assert.strictEqual(insertedEarly.filter((c) => c.kind === 'added').length, 1)
assert.strictEqual(insertedEarly.filter((c) => c.kind === 'moved').length, 3)

console.log('careerDiff.check.ts — all assertions passed')
