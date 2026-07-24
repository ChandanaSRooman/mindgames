import { useEffect, useState } from 'react'
import { Clock, Radio } from 'lucide-react'

// Matches the 1-hour default duration assumed by the .ics export — used here
// to decide when an event flips from "Live now" to "Ended".
export const EVENT_DURATION_MS = 60 * 60 * 1000

export type EventPhase = 'upcoming' | 'live' | 'ended'

export function phaseOf(startsAt: string, now: number): EventPhase {
  const start = +new Date(startsAt)
  const end = start + EVENT_DURATION_MS
  if (now < start) return 'upcoming'
  if (now < end) return 'live'
  return 'ended'
}

// Live countdown/status for one event: ticks every second while upcoming or
// live so the "Starts in…" timer and the live/ended flip feel real-time.
export function useEventPhase(startsAt: string) {
  const [now, setNow] = useState(() => Date.now())
  const phase = phaseOf(startsAt, now)

  useEffect(() => {
    if (phase === 'ended') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  const start = +new Date(startsAt)
  const diff = Math.max(0, start - now)
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let countdownLabel = ''
  if (days > 0) countdownLabel = `${days}d ${hours}h`
  else if (hours > 0) countdownLabel = `${hours}h ${minutes}m`
  else countdownLabel = `${minutes}m ${seconds}s`

  return { phase, countdownLabel }
}

// Pure presentational badge — the caller runs useEventPhase once and passes
// the result in, so a card that also needs `phase` for its own logic doesn't
// end up running two independent per-second timers for the same event.
export function EventPhaseBadge({ phase, countdownLabel }: { phase: EventPhase; countdownLabel: string }) {
  if (phase === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
        <Radio size={11} className="animate-pulse" /> Live now
      </span>
    )
  }
  if (phase === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
        <Clock size={11} /> Starts in {countdownLabel}
      </span>
    )
  }
  return null
}
