import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import type { AppEvent } from '../types'

/** How often the "still upcoming" cutoff is re-evaluated. */
const TICK_MS = 60_000

/**
 * Approved, still-upcoming events, soonest first.
 *
 * Shared by both sidebars specifically so the approved-only guard can't be
 * present in one and missing in the other: `GET /api/events` returns approved
 * events *plus the caller's own*, so a host's pending/rejected events are in
 * `events` and must be filtered out before display.
 */
export function useUpcomingEvents(limit: number): AppEvent[] {
  const { events } = useApp()

  // A `Date.now()` read inside the memo stays frozen until `events` itself
  // changes, so an event that starts while the tab is open would linger in the
  // list indefinitely. A slow tick re-evaluates the cutoff instead.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  return useMemo(
    () =>
      events
        .filter((e) => e.status === 'approved' && +new Date(e.startsAt) >= now)
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, limit),
    [events, limit, now],
  )
}
