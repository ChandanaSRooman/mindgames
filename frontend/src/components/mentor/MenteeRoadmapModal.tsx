import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Flag, HelpCircle, Loader2, Printer, Sparkles, Target, TrendingUp, X } from 'lucide-react'
import { Avatar, Button } from '../ui'
import { api } from '../../lib/api'
import { SERVICE_LABELS, type MenteeBrief, type MenteeRoadmap, type ServiceType } from '../../types'

/**
 * A mentee's roadmap, read-only, for the mentor about to meet them.
 *
 * Access is enforced server-side by an accepted session between the two —
 * this component simply reports whatever the API allows. The print button
 * uses the browser's own print-to-PDF via a print stylesheet, rather than
 * pulling in a PDF library for one screen.
 */
export function MenteeRoadmapModal({ menteeId, onClose }: { menteeId: string; onClose: () => void }) {
  const [data, setData] = useState<MenteeRoadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // The briefing is generated, so it loads separately and the roadmap never
  // waits on it — a slow or unavailable model must not block the plan.
  const [brief, setBrief] = useState<MenteeBrief | null>(null)
  const [briefState, setBriefState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    api
      .getMenteeRoadmap(menteeId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load that roadmap.'))
      .finally(() => setLoading(false))
    api
      .getMenteeBrief(menteeId)
      .then((r) => { setBrief(r.brief); setBriefState('ready') })
      .catch(() => setBriefState('failed'))
  }, [menteeId])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8 print:static print:bg-white print:p-0" onClick={onClose}>
      <div
        id="mentee-roadmap-print"
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl print:max-w-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edeff1] px-6 py-4 print:border-0">
          <div>
            <h2 className="text-lg font-bold text-[#1c1c1c]">Career roadmap</h2>
            <p className="text-sm text-[#878a8c]">Shared with you because you have a session together.</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" icon={<Printer size={14} />} onClick={() => window.print()}>
              Save as PDF
            </Button>
            <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 size={26} className="animate-spin text-[#ff4500]" />
          </div>
        ) : error ? (
          <p className="px-6 py-12 text-center text-sm text-[#878a8c]">{error}</p>
        ) : data ? (
          <div className="px-6 py-5">
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={data.member.name} src={data.member.photo} size={48} />
              <div>
                <p className="font-bold text-[#1c1c1c]">{data.member.name}</p>
                <p className="text-sm text-[#878a8c]">
                  {[data.member.designation, data.member.company].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-orange-100 bg-[#fff6f0] px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 font-bold text-[#1c1c1c]">
                <Target size={16} className="text-[#ff4500]" />
                {data.goal.currentRole || 'Current role'} → {data.goal.targetRole || 'Still exploring'}
              </p>
              <p className="mt-0.5 text-sm text-[#878a8c]">
                {data.timelineMonths} months · {data.hoursPerWeek} hours/week
              </p>
            </div>

            {/* What they said in their own words. The single most useful
                thing for a mentor preparing, and not derivable from stages. */}
            {(data.context.note || data.context.helpTypes.length > 0) && (
              <div className="mb-5 rounded-xl border border-[#edeff1] px-4 py-3">
                <p className="text-xs font-bold tracking-wide text-[#878a8c] uppercase">What they asked for</p>
                {data.context.note && <p className="mt-1.5 text-sm text-[#1c1c1c]">“{data.context.note}”</p>}
                {data.context.helpTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.context.helpTypes.map((h) => (
                      <span key={h} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#878a8c]">
                        {SERVICE_LABELS[h as ServiceType] ?? h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generated briefing. Sits above the plan because it is what a
                mentor actually reads in the minutes before a session. */}
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#878a8c] uppercase">
                <Sparkles size={12} className="text-[#ff4500]" />
                Mentor briefing
              </p>
              {briefState === 'loading' ? (
                <p className="rounded-xl border border-[#edeff1] px-4 py-3 text-sm text-[#878a8c]">
                  Preparing insights…
                </p>
              ) : briefState === 'failed' || !brief ? (
                <p className="rounded-xl border border-[#edeff1] px-4 py-3 text-sm text-[#878a8c]">
                  Insights couldn't be generated right now — the plan below is still complete.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="rounded-xl border border-orange-100 bg-[#fff6f0] px-4 py-3 text-sm text-[#1c1c1c]">
                    {brief.summary}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <BriefList icon={<TrendingUp size={13} />} title="Strengths" items={brief.strengths} tone="green" />
                    <BriefList icon={<Target size={13} />} title="Gaps to close" items={brief.gaps} tone="orange" />
                    <BriefList icon={<Flag size={13} />} title="Focus this session" items={brief.focusThisSession} tone="blue" />
                    <BriefList icon={<HelpCircle size={13} />} title="Questions to ask" items={brief.questionsToAsk} tone="grey" />
                  </div>
                  {brief.watchOuts.length > 0 && (
                    <BriefList icon={<AlertTriangle size={13} />} title="Watch out for" items={brief.watchOuts} tone="amber" />
                  )}
                </div>
              )}
            </div>

            <p className="mb-2 text-xs font-bold tracking-wide text-[#878a8c] uppercase">Their plan</p>
            <ol className="flex flex-col gap-2">
              {data.stages.map((s, i) => (
                <li
                  key={s.stepKey}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    s.status === 'completed'
                      ? 'border-green-200 bg-green-50/50'
                      : s.status === 'in_progress'
                        ? 'border-[#ff4500]/30 bg-orange-50/40'
                        : 'border-[#edeff1]'
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      s.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : s.status === 'in_progress'
                          ? 'bg-[#ff4500] text-white'
                          : 'bg-gray-200 text-[#878a8c]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1c1c1c]">{s.title}</p>
                    <p className="text-xs text-[#878a8c]">
                      {s.durationWeeks ? `${s.durationWeeks} weeks · ` : ''}
                      {s.status === 'completed' ? 'Completed' : s.status === 'in_progress' ? 'In progress' : 'Upcoming'}
                    </p>
                  </div>
                  {s.status === 'in_progress' && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#ff4500] px-2 py-0.5 text-[10px] font-bold text-white">
                      <Flag size={10} /> NOW
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

const TONES: Record<string, string> = {
  green: 'border-green-200 bg-green-50/60 text-green-900',
  orange: 'border-orange-200 bg-orange-50/60 text-orange-900',
  blue: 'border-blue-200 bg-blue-50/60 text-blue-900',
  amber: 'border-amber-200 bg-amber-50/60 text-amber-900',
  grey: 'border-[#edeff1] bg-gray-50/60 text-[#1c1c1c]',
}

function BriefList({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
  tone: keyof typeof TONES
}) {
  if (items.length === 0) return null
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${TONES[tone]}`}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
        {icon}
        {title}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((t) => (
          <li key={t} className="flex gap-1.5 text-xs leading-snug">
            <span aria-hidden>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
