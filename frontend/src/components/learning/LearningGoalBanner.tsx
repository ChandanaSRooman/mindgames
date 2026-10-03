import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, Clock, HandHelping, Target } from 'lucide-react'
import { monthsLabel, stepPosition, supportLabel } from '../../lib/learningHub'
import type { LearningRoadmapSummary } from '../../types'

/**
 * "Your current learning goal" — built entirely from the overview response
 * the page already has; no request of its own.
 */
export function LearningGoalBanner({
  roadmap,
  currentStepKey,
  supportPreference,
}: {
  roadmap: LearningRoadmapSummary | null
  currentStepKey: string | null
  supportPreference: string | null
}) {
  if (!roadmap) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edeff1] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
            <Target size={20} />
          </span>
          <div>
            <p className="text-sm font-bold text-[#1c1c1c]">Set your learning goal</p>
            <p className="text-xs text-[#878a8c]">
              Build your career roadmap and we'll recommend resources and projects for each stage.
            </p>
          </div>
        </div>
        <Link
          to="/career-guidance/assessment"
          className="inline-flex items-center gap-1 rounded-lg border border-[#ff4500]/40 px-3 py-1.5 text-xs font-semibold text-[#ff4500] hover:bg-orange-50"
        >
          Build my roadmap <ArrowRight size={12} />
        </Link>
      </section>
    )
  }

  const current = roadmap.stages.find((s) => s.stepKey === currentStepKey)
  const position = stepPosition(roadmap.stages, currentStepKey)
  const support = supportLabel(supportPreference)

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[#edeff1] bg-white px-4 py-3 shadow-sm">
      {/* basis-full below sm so the goal keeps a whole row to itself: squeezed
          beside the stats it truncated to "Deepen AWS and…", which is the one
          line on this banner that has to be readable. */}
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
          <Target size={22} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-[#878a8c]">Your Current Learning Goal</p>
            {position && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#ff4500]">
                Step {position.index} of {position.total}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-base font-bold text-[#1c1c1c]">{current?.title ?? 'Roadmap complete'}</p>
          <p className="truncate text-xs text-[#878a8c]">
            From your career goal: {roadmap.goal.currentRole || 'Today'} → {roadmap.goal.targetRole || 'your next role'}
          </p>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
        <Stat icon={<Calendar size={14} />} label="Timeline" value={monthsLabel(roadmap.timelineMonths)} />
        <Stat icon={<Clock size={14} />} label="Weekly time" value={`${roadmap.hoursPerWeek} hours/week`} />
        {support && <Stat icon={<HandHelping size={14} />} label="Support preference" value={support} />}
      </dl>

      <Link
        to="/career-guidance"
        className="inline-flex items-center gap-1 rounded-lg border border-[#ff4500]/40 px-3 py-1.5 text-xs font-semibold text-[#ff4500] hover:bg-orange-50"
      >
        View roadmap <ArrowRight size={12} />
      </Link>
    </section>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#878a8c]">{icon}</span>
      <div>
        <dt className="text-[10px] text-[#878a8c]">{label}</dt>
        <dd className="font-semibold text-[#1c1c1c]">{value}</dd>
      </div>
    </div>
  )
}
