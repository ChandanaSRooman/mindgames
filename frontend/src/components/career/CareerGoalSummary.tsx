import { ArrowRight, CalendarDays, Clock, Target, Users } from 'lucide-react'
import type { CareerRoadmap } from '../../types'
import { SUPPORT_PREFERENCES } from '../../types'

/** The goal banner at the top of the roadmap: where they are, where they're
 *  going, and the three constraints the plan was built around. */
export function CareerGoalSummary({
  roadmap,
  supportPreference,
}: {
  roadmap: CareerRoadmap
  supportPreference: string
}) {
  const supportLabel =
    SUPPORT_PREFERENCES.find((s) => s.value === supportPreference)?.label ?? 'Alumni help'

  return (
    <div className="rounded-xl border border-orange-100 bg-[#fff6f0] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#ff4500] shadow-sm">
            <Target size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#878a8c]">Your goal</p>
            <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-[#1c1c1c]">
              {roadmap.goal.currentRole || 'Your current role'}
              <ArrowRight size={16} className="text-[#ff4500]" />
              {roadmap.goal.targetRole || 'Still exploring'}
            </p>
            <p className="mt-0.5 text-sm text-[#878a8c]">
              A plan built from your profile, skills and the time you have.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:border-l lg:border-orange-100 lg:pl-6">
          <Fact icon={<CalendarDays size={16} />} label="Target" value={`${roadmap.timelineMonths} months`} />
          <Fact icon={<Clock size={16} />} label="Weekly time" value={`${roadmap.hoursPerWeek} hours/week`} />
          <Fact icon={<Users size={16} />} label="Support preference" value={supportLabel} />
        </div>
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[#ff4500]">{icon}</span>
      <div>
        <p className="text-xs font-medium text-[#878a8c]">{label}</p>
        <p className="text-sm font-bold text-[#1c1c1c]">{value}</p>
      </div>
    </div>
  )
}
