import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { EventCard } from './EventCard'
import { EventsEmptyState } from './EventsEmptyState'
import { EVENT_DURATION_MS } from './EventPhase'
import type { EventsOutletContext } from './EventsLayout'

// "Past Webinars & Recordings" — hosts can share a recording link (or any
// recap) via the existing "Post update" flow on each card once the event
// has ended, so no separate recording-link field is needed.
export function EventsPast() {
  const { events, posts } = useApp()
  const { openQuickView } = useOutletContext<EventsOutletContext>()
  const now = Date.now()

  const past = useMemo(
    () =>
      events
        .filter((e) => +new Date(e.startsAt) + EVENT_DURATION_MS < now)
        .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)),
    [events, now],
  )

  return (
    <div className="flex flex-col gap-4">
      {past.map((e) => (
        <EventCard
          key={e.id}
          event={e}
          updates={posts.filter((p) => p.eventId === e.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))}
          onOpenQuickView={openQuickView}
        />
      ))}
      {past.length === 0 && <EventsEmptyState title="No past events" />}
    </div>
  )
}
