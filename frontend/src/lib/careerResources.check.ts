import assert from 'node:assert'
import { belongsToStage, doneCount, groupByStage, isSharedWithMe, UNSORTED_TITLE } from './careerResources'
import type { CareerResource, CareerStage } from '../types'

const stage = (stepKey: string, title: string): CareerStage => ({
  stepKey,
  title,
  status: 'upcoming',
  durationWeeks: null,
  relevantAlumniIds: [],
  relevantServiceIds: [],
})

const res = (over: Partial<CareerResource> & { id: string }): CareerResource => ({
  userId: 'me',
  title: 'r',
  kind: 'article',
  status: 'saved',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const RM = 'roadmap-1'
const stages = [stage('s0', 'Here'), stage('s1', 'Learn AWS'), stage('s2', 'Build'), stage('s3', 'Goal')]

// --- grouping ---------------------------------------------------------------

// Groups come back in the roadmap's own order, not the resources' order.
const grouped = groupByStage(
  [
    res({ id: 'b', roadmapId: RM, stepKey: 's2' }),
    res({ id: 'a', roadmapId: RM, stepKey: 's1' }),
  ],
  stages,
  RM,
)
assert.deepStrictEqual(grouped.map((g) => g.stepKey), ['s1', 's2'])
assert.deepStrictEqual(grouped.map((g) => g.title), ['Learn AWS', 'Build'])

// Stages with nothing in them are dropped, not rendered empty.
assert.strictEqual(groupByStage([res({ id: 'a', roadmapId: RM, stepKey: 's1' })], stages, RM).length, 1)

// A resource with no stage at all lands in the catch-all group, last.
const withLoose = groupByStage(
  [res({ id: 'a', roadmapId: RM, stepKey: 's1' }), res({ id: 'loose' })],
  stages,
  RM,
)
assert.deepStrictEqual(withLoose.map((g) => g.stepKey), ['s1', null])
assert.strictEqual(withLoose[1].title, UNSORTED_TITLE)

// THE ONE THAT MATTERS: a resource saved against an EARLIER roadmap keeps its
// stepKey, and that key also exists in the new plan. It must not be re-filed
// under the new plan's same-named stage — it falls into the catch-all instead.
const stale = groupByStage([res({ id: 'old', roadmapId: 'roadmap-0', stepKey: 's1' })], stages, RM)
assert.deepStrictEqual(stale.map((g) => g.stepKey), [null], 'stale resource must not claim a new stage')
assert.strictEqual(stale[0].resources[0].id, 'old', 'stale resource must still be visible')

// Nothing at all produces no groups (so the page can show its empty state).
assert.deepStrictEqual(groupByStage([], stages, RM), [])

// A resource is never counted in two groups.
const twice = groupByStage([res({ id: 'a', roadmapId: RM, stepKey: 's1' })], stages, RM)
assert.strictEqual(twice.reduce((n, g) => n + g.resources.length, 0), 1)

// --- belongsToStage ---------------------------------------------------------

assert.strictEqual(belongsToStage(res({ id: 'x', roadmapId: RM, stepKey: 's1' }), RM, 's1'), true)
assert.strictEqual(belongsToStage(res({ id: 'x', roadmapId: RM, stepKey: 's1' }), RM, 's2'), false)
assert.strictEqual(belongsToStage(res({ id: 'x', roadmapId: 'other', stepKey: 's1' }), RM, 's1'), false)
assert.strictEqual(belongsToStage(res({ id: 'x' }), RM, 's1'), false)

// --- counting and ownership -------------------------------------------------

assert.strictEqual(doneCount([res({ id: 'a', status: 'done' }), res({ id: 'b', status: 'saved' })]), 1)
assert.strictEqual(doneCount([]), 0)
assert.strictEqual(doneCount([res({ id: 'a', status: 'in_progress' })]), 0, 'in_progress is not done')

assert.strictEqual(isSharedWithMe(res({ id: 'a', userId: 'them' }), 'me'), true)
assert.strictEqual(isSharedWithMe(res({ id: 'a', userId: 'me' }), 'me'), false)

console.log('careerResources.check.ts — all assertions passed')
