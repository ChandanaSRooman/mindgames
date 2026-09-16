import { Link } from 'react-router-dom'
import { Award, GraduationCap, Handshake, MapPin, Quote, Users, X } from 'lucide-react'
import { Avatar, Button, cx } from '../ui'
import type { CompanyRoadmap } from '../../types'

// One alumnus's route into this company, read top to bottom in the order they
// actually walked it.
//
// Two visually distinct halves, and the distinction matters:
//   · the TIMELINE is derived from their profile — where they were and when.
//     It is always present, because every member has a work history.
//   · the STEPS and ADVICE are what they wrote when asked to help. Only some
//     people have written them, so they are clearly badged rather than blended
//     in — a reader must be able to tell what was stated from what was derived.
//
// Connect / Reach Out deliberately live on the member's profile rather than
// here: those flows already exist there, and stacking a second modal on top of
// this one to reach them would be worse than a link.
export function RoadmapDetailModal({
  roadmap,
  companyName,
  onClose,
}: {
  roadmap: CompanyRoadmap
  companyName: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[#edeff1] p-5">
          <Avatar name={roadmap.name} src={roadmap.photo} size={48} />
          <div className="min-w-0 flex-1">
            <Link
              to={`/profile/${roadmap.userId}`}
              className="font-bold text-[#1c1c1c] hover:underline"
            >
              {roadmap.name}
            </Link>
            <p className="text-sm text-[#878a8c]">
              {roadmap.roleGoal || roadmap.currentRole} at {companyName}
            </p>
            {roadmap.headline && (
              <p className="mt-1.5 text-sm text-[#1c1c1c]">{roadmap.headline}</p>
            )}
          </div>
          <button onClick={onClose} className="text-[#878a8c] hover:text-[#1c1c1c]">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* Where they started */}
          {(roadmap.course || roadmap.batchYear > 0) && (
            <p className="flex items-center gap-1.5 text-xs text-[#6b6e70]">
              <GraduationCap size={13} className="text-[#ff4500]" />
              Started at Rooman
              {roadmap.course ? ` — ${roadmap.course}` : ''}
              {roadmap.batchYear > 0 ? `, batch ${roadmap.batchYear}` : ''}
            </p>
          )}

          {/* The derived timeline */}
          {roadmap.steps.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold tracking-wide text-[#878a8c] uppercase">
                Their path
              </h3>
              <ol className="relative flex flex-col gap-4 border-l border-[#edeff1] pl-5">
                {roadmap.steps.map((step, i) => (
                  <li key={`${step.company}-${step.period}-${i}`} className="relative">
                    <span
                      className={cx(
                        'absolute top-1 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white',
                        step.atThisCompany ? 'bg-[#ff4500]' : 'bg-[#c9cccd]',
                      )}
                    />
                    <p
                      className={cx(
                        'text-sm font-semibold',
                        step.atThisCompany ? 'text-[#ff4500]' : 'text-[#1c1c1c]',
                      )}
                    >
                      {step.role || 'Role not listed'}
                    </p>
                    <p className="text-xs text-[#878a8c]">
                      {step.company}
                      {step.period ? ` · ${step.period}` : ''}
                    </p>
                    {step.summary && (
                      <p className="mt-1 text-xs text-[#6b6e70]">{step.summary}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* What they wrote */}
          {roadmap.stages.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold tracking-wide text-[#878a8c] uppercase">
                What they say it takes
              </h3>
              <ol className="flex flex-col gap-3">
                {roadmap.stages.map((stage, i) => (
                  <li key={`${stage.title}-${i}`} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff1ec] text-xs font-bold text-[#ff4500]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1c1c1c]">{stage.title}</p>
                      {stage.detail && (
                        <p className="text-xs text-[#6b6e70]">{stage.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {roadmap.advice && (
            <blockquote className="flex gap-2 rounded-xl bg-[#f8f9fa] p-3">
              <Quote size={14} className="mt-0.5 shrink-0 text-[#ff4500]" />
              <p className="text-sm whitespace-pre-line text-[#1c1c1c]">{roadmap.advice}</p>
            </blockquote>
          )}

          {/* Proof points */}
          {roadmap.certifications.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-[#878a8c] uppercase">
                Certifications they hold
              </h3>
              <ul className="flex flex-col gap-1">
                {roadmap.certifications.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex items-center gap-1.5 text-xs text-[#6b6e70]">
                    <Award size={12} className="shrink-0 text-[#ff4500]" />
                    {c.name}
                    {c.issuer ? ` · ${c.issuer}` : ''}
                    {c.year ? ` · ${c.year}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {roadmap.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {roadmap.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[#f8f9fa] px-2 py-0.5 text-[11px] text-[#6b6e70]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* How to reach them */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[#edeff1] pt-4">
            {roadmap.openToReferrals && (
              <span className="flex items-center gap-1 rounded-full bg-[#fff1ec] px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]">
                <Handshake size={11} /> Open to referrals
              </span>
            )}
            {roadmap.isMentor && (
              <span className="flex items-center gap-1 rounded-full bg-[#fff1ec] px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]">
                <Users size={11} /> Mentors
              </span>
            )}
            {roadmap.mutualConnections > 0 && (
              <span className="text-[11px] text-[#878a8c]">
                {roadmap.mutualConnections} mutual connection
                {roadmap.mutualConnections > 1 ? 's' : ''}
              </span>
            )}
            {roadmap.city && (
              <span className="flex items-center gap-1 text-[11px] text-[#878a8c]">
                <MapPin size={11} /> {roadmap.city}
              </span>
            )}
            <Link to={`/profile/${roadmap.userId}`} className="ml-auto">
              <Button variant="primary" className="!px-3 !py-1.5 text-xs">
                View profile
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
