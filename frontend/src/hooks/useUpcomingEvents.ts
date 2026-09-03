import { useMemo } from 'react'
import { useApp } from '../store/AppStore'
import type { AppEvent } from '../types'

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
  return useMemo(
    () =>
      events
        .filter((e) => e.status === 'approved' && +new Date(e.startsAt) >= Date.now())
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, limit),
    [events, limit],
  )
}
