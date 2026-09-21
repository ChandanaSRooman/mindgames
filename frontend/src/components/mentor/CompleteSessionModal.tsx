import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, X } from 'lucide-react'
import { Button } from '../ui'
import { DOMAINS, type MentorshipSession } from '../../types'

/**
 * Captures how long a session actually ran, and what it covered.
 *
 * The duration is the point: profile hours, streaks and badges are all built
 * from it, and a "completed" session with no duration is exactly the shape a
 * session that happened somewhere else leaves behind. The mentee confirms
 * separately before any of it counts.
 */
export function CompleteSessionModal({
  session,
  onClose,
  onConfirm,
}: {
  session: MentorshipSession
  onClose: () => void
  onConfirm: (durationMinutes: number, domain: string) => void
}) {
  const [minutes, setMinutes] = useState(60)
  const [domain, setDomain] = useState('')

  const PRESETS = [30, 45, 60, 90]

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-[#1c1c1c]">Mark session completed</h2>
          <button onClick={onClose} className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-[#878a8c]">
          “{session.topic}” with {session.menteeName}. They'll be asked to confirm it — once they do,
          it counts towards both your records.
        </p>

        <label className="mb-1.5 block text-xs font-semibold text-[#878a8c]">How long did it run?</label>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                minutes === m
                  ? 'border-[#ff4500] bg-orange-50 text-[#ff4500]'
                  : 'border-[#edeff1] text-[#1c1c1c] hover:bg-gray-50'
              }`}
            >
              {m} min
            </button>
          ))}
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 0)))}
              className="w-20 rounded-lg border border-[#edeff1] px-2 py-1.5 text-center text-sm outline-none focus:border-[#ff4500]"
            />
            <span className="text-xs text-[#878a8c]">min</span>
          </span>
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-[#878a8c]">What was it about? (optional)</label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        >
          <option value="">Not specified</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-[#878a8c]">
          <Clock size={13} className="shrink-0" />
          {minutes} minutes will be added to your mentoring hours once {session.menteeName.split(' ')[0]} confirms.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(minutes, domain)}>Mark completed</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
