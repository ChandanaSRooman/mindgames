// Sanity checks for roadmap progress + completion ordering. Run with:
//   npm --prefix frontend run check
import assert from 'node:assert'
import { blockedBy, roadmapProgress, workableStages } from './careerProgress'
import type { CareerStage, CareerStageStatus } from '../types'

const stage = (key: string, title: string, status: CareerStageStatus): CareerStage =>
  ({
    stepKey: key,
    title,
    status,
    durationWeeks: 4,
    relevantAlumniIds: [],
    relevantServiceIds: [],
  }) as CareerStage

// here -> a -> b -> c -> goal
const plan = (a: CareerStageStatus, b: CareerStageStatus, c: CareerStageStatus): CareerStage[] => [
  stage('s0', 'Working professional', 'completed'),
  stage('s1', 'Foundations', a),
  stage('s2', 'Projects', b),
  stage('s3', 'Interviews', c),
  stage('s4', 'AI Engineer', 'upcoming'),
]

// --- what counts as work ----------------------------------------------------

assert.deepStrictEqual(
  workableStages(plan('upcoming', 'upcoming', 'upcoming')).map((s) => s.title),
  ['Foundations', 'Projects', 'Interviews'],
  'bookends are not work',
)

// A plan with nothing between the bookends has no work in it.
assert.deepStrictEqual(workableStages([stage('a', 'Here', 'completed'), stage('b', 'Goal', 'upcoming')]), [])

// --- progress ---------------------------------------------------------------

assert.deepStrictEqual(roadmapProgress(plan('upcoming', 'upcoming', 'upcoming')), {
  total: 3, done: 0, percent: 0, complete: false,
})
assert.deepStrictEqual(roadmapProgress(plan('completed', 'upcoming', 'upcoming')), {
  total: 3, done: 1, percent: 33, complete: false,
})
assert.deepStrictEqual(roadmapProgress(plan('completed', 'completed', 'completed')), {
  total: 3, done: 3, percent: 100, complete: true,
})

// The goal stage being 'upcoming' must not stop the plan reading as finished —
// it is the destination, not a task.
assert.strictEqual(roadmapProgress(plan('completed', 'completed', 'completed')).complete, true)

// A two-stage plan has no work, so it must NOT report itself complete.
const empty = roadmapProgress([stage('a', 'Here', 'completed'), stage('b', 'Goal', 'upcoming')])
assert.strictEqual(empty.complete, false, 'a plan with no work is not a finished plan')
assert.strictEqual(empty.percent, 0)

// --- ordering ---------------------------------------------------------------

// The first workable stage is always open.
assert.strictEqual(blockedBy(plan('upcoming', 'upcoming', 'upcoming'), 's1'), null)

// The second is blocked by the first, and names it.
assert.strictEqual(blockedBy(plan('upcoming', 'upcoming', 'upcoming'), 's2'), 'Foundations')

// Once the first is done, the second opens.
assert.strictEqual(blockedBy(plan('completed', 'upcoming', 'upcoming'), 's2'), null)

// The blocker reported is the EARLIEST unfinished one, not the nearest.
assert.strictEqual(blockedBy(plan('upcoming', 'completed', 'upcoming'), 's3'), 'Foundations')

// A paused stage still blocks — pausing is not finishing.
assert.strictEqual(blockedBy(plan('paused', 'upcoming', 'upcoming'), 's2'), 'Foundations')

// The "you are here" bookend never blocks, even when it is not completed —
// it has no completion control, so requiring it would deadlock the plan.
const unfinishedStart = [
  stage('s0', 'Working professional', 'in_progress'),
  stage('s1', 'Foundations', 'upcoming'),
  stage('s2', 'Projects', 'upcoming'),
  stage('s3', 'AI Engineer', 'upcoming'),
]
assert.strictEqual(blockedBy(unfinishedStart, 's1'), null, 'stage 0 must never deadlock the plan')

// An unknown key is not blocked (the server rejects it separately).
assert.strictEqual(blockedBy(plan('upcoming', 'upcoming', 'upcoming'), 'nope'), null)

console.log('careerProgress.check.ts — all assertions passed')
