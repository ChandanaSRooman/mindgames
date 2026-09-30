/**
 * Sessions a mentor has completed that still wait on the mentee's "it
 * happened". Pure so the admin panel and its check agree on the rules.
 */

/** Hours between reminders — keep in sync with REMIND_EVERY_HOURS in
 *  backend/src/routes/mentorship.routes.ts, which is what actually enforces it. */
export const REMIND_EVERY_HOURS = 24

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Whole days since the mentor completed it; null when that isn't recorded. */
export function daysWaiting(completedAt: string | undefined, now: number): number | null {
  if (!completedAt) return null
  const t = +new Date(completedAt)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / DAY))
}

/** Whether another reminder is allowed yet. */
export function canRemind(remindedAt: string | undefined, now: number): boolean {
  if (!remindedAt) return true
  const t = +new Date(remindedAt)
  if (Number.isNaN(t)) return true
  return now - t >= REMIND_EVERY_HOURS * HOUR
}
