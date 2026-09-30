import assert from 'node:assert'
import { canRemind, daysWaiting } from './confirmations'

const NOW = Date.parse('2026-10-10T12:00:00.000Z')

// --- days waiting -----------------------------------------------------------
assert.strictEqual(daysWaiting('2026-10-10T08:00:00.000Z', NOW), 0, 'same day')
assert.strictEqual(daysWaiting('2026-10-08T12:00:00.000Z', NOW), 2)
assert.strictEqual(daysWaiting('2026-10-08T12:00:01.000Z', NOW), 1, 'just under 2 days rounds down')
assert.strictEqual(daysWaiting('2026-10-11T12:00:00.000Z', NOW), 0, 'clock skew never goes negative')
assert.strictEqual(daysWaiting(undefined, NOW), null)
assert.strictEqual(daysWaiting('nonsense', NOW), null)

// --- reminder window --------------------------------------------------------
assert.strictEqual(canRemind(undefined, NOW), true, 'never reminded')
assert.strictEqual(canRemind('2026-10-10T11:00:00.000Z', NOW), false, '1h ago')
assert.strictEqual(canRemind('2026-10-09T12:00:01.000Z', NOW), false, 'just under 24h')
assert.strictEqual(canRemind('2026-10-09T12:00:00.000Z', NOW), true, 'exactly 24h')
assert.strictEqual(canRemind('nonsense', NOW), true)

console.log('confirmations.check.ts — all assertions passed')
