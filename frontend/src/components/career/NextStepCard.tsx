import { Link } from 'react-router-dom'
import { Briefcase, ChevronRight, Flag, Users, Zap, GraduationCap } from 'lucide-react'
import { Button, Card } from '../ui'
import type { CareerStage } from '../../types'

/** The single "do this next" prompt — the roadmap's first unfinished stage. */
export function NextStepCard({ stage, onFindAlumni }: { stage?: CareerStage; onFindAlumni: () => void }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-[#fff6f0] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#ff4500] shadow-sm">
          <Flag size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#878a8c]">Next step</p>
          <p className="text-base font-bold text-[#1c1c1c]">
            {stage ? `This week: ${stage.title}` : 'You’ve completed every stage — time to rebuild your roadmap.'}
          </p>
          {stage?.durationWeeks ? (
            <p className="mt-0.5 text-sm text-[#878a8c]">
              Planned over about {stage.durationWeeks} weeks at your current pace.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={<Users size={14} />} onClick={onFindAlumni}>
              Find alumni
            </Button>
            <Link to="/news">
              <Button variant="outline">View learning resources</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Links out to the features that already exist — Career Guidance points at
 *  them rather than rebuilding People/Jobs/Mentors inside itself. */
export function QuickAccessCard() {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-50 text-[#ff4500]">
          <Zap size={16} />
        </span>
        <div>
          <h2 className="text-base font-bold text-[#1c1c1c]">Quick access</h2>
          <p className="text-xs text-[#878a8c]">Jump to your key resources.</p>
        </div>
      </div>

      <div className="flex flex-col">
        <QuickLink
          to="/network/matches"
          icon={<Users size={16} />}
          title="Recommended People"
          subtitle="People who can help you"
        />
        <QuickLink
          to="/jobs"
          icon={<Briefcase size={16} />}
          title="Jobs for You"
          subtitle="Matching opportunities"
        />
        <QuickLink
          to="/network/mentors"
          icon={<GraduationCap size={16} />}
          title="Mentors for You"
          subtitle="Get guidance from experts"
        />
      </div>
    </Card>
  )
}

function QuickLink({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-gray-50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-50 text-[#878a8c]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#1c1c1c]">{title}</span>
        <span className="block text-xs text-[#878a8c]">{subtitle}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-[#878a8c]" />
    </Link>
  )
}
