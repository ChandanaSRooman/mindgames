import { useState } from 'react'
import { BookOpen, Check, CircleDashed, Flag, Lock, Map, Target, Users } from 'lucide-react'
import { Card } from '../ui'
import { AlumniListModal } from './AlumniListModal'
import { blockedBy } from '../../lib/careerProgress'
import type { AlumniHelper, CareerRoadmap, CareerStage, CareerStageStatus } from '../../types'

const BADGE: Record<CareerStageStatus, string> = {
  completed: 'bg-green-500 text-white',
  in_progress: 'bg-[#ff4500] text-white',
  upcoming: 'bg-gray-200 text-[#878a8c]',
  paused: 'bg-amber-400 text-white',
}

/** The horizontal plan. Scrolls sideways on desktop when there are many
 *  stages and stacks vertically on small screens — the roadmap has to stay
 *  readable on a phone rather than being a shrunken desktop row. */
export function CareerRoadmapTimeline({
  roadmap,
  people,
  onStepStatus,
  onBookPerson,
}: {
  roadmap: CareerRoadmap
  /** The roadmap's full matched-alumni list — each stage card filters this
   *  down to its own relevantAlumniIds rather than fetching anything new. */
  people: AlumniHelper[]
  onStepStatus: (stepKey: string, status: CareerStageStatus) => void
  onBookPerson: (person: AlumniHelper) => void
}) {
  // Which stage's alumni list is open, if any. One at a time, so opening a
  // second stage's list closes the first rather than stacking modals.
  const [openFor, setOpenFor] = useState<string | null>(null)
  const openStage = roadmap.stages.find((s) => s.stepKey === openFor)
  const openStagePeople = openStage
    ? people.filter((p) => openStage.relevantAlumniIds.includes(p.id))
    : []

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-orange-50 text-[#ff4500]">
            <Map size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[#1c1c1c]">Your Personalized Roadmap</h2>
            <p className="text-sm text-[#878a8c]">
              A step-by-step plan to reach your goal, with support from the Rooman alumni network.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-[#878a8c]">
          <Legend className="bg-green-500" label="Completed" />
          <Legend className="bg-[#ff4500]" label="In Progress" />
          <Legend className="bg-gray-300" label="Upcoming" />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {roadmap.stages.map((stage, i) => (
          <div key={stage.stepKey} className="flex flex-col lg:min-w-0 lg:flex-1 lg:flex-row lg:items-stretch">
            <StageCard
              stage={stage}
              index={i}
              isFirst={i === 0}
              isLast={i === roadmap.stages.length - 1}
              blockedBy={blockedBy(roadmap.stages, stage.stepKey)}
              onStepStatus={onStepStatus}
              onShowPeople={() => setOpenFor(stage.stepKey)}
            />
            {i < roadmap.stages.length - 1 && (
              <span
                aria-hidden
                className="mx-auto h-4 w-px shrink-0 self-center border-l border-dashed border-gray-300 lg:mx-1 lg:h-px lg:w-4 lg:border-l-0 lg:border-t"
              />
            )}
          </div>
        ))}
      </div>

      {openStage && (
        <AlumniListModal
          people={openStagePeople}
          title={`Alumni who can help with “${openStage.title}”`}
          subtitle={`${openStagePeople.length} ${openStagePeople.length === 1 ? 'person matches' : 'people match'} this stage`}
          onClose={() => setOpenFor(null)}
          onBook={(p) => {
            onBookPerson(p)
            setOpenFor(null)
          }}
        />
      )}
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  )
}

function StageCard({
  stage,
  index,
  isFirst,
  isLast,
  blockedBy,
  onStepStatus,
  onShowPeople,
}: {
  stage: CareerStage
  index: number
  isFirst: boolean
  isLast: boolean
  /** Title of the earlier stage that still has to be finished, or null when
   *  this stage is open. The server enforces the same rule. */
  blockedBy: string | null
  onStepStatus: (stepKey: string, status: CareerStageStatus) => void
  onShowPeople: () => void
}) {
  const Icon = isFirst ? Flag : isLast ? Target : stage.status === 'completed' ? Check : BookOpen
  const helpers = stage.relevantAlumniIds.length
  // An already-completed stage is never locked — reopening it stays available
  // so a member can correct a mistake.
  const locked = blockedBy !== null && stage.status !== 'completed'

  return (
    <div
      className={`flex w-full min-w-0 flex-1 flex-col items-center rounded-xl border p-3 text-center ${
        isLast
          ? 'border-indigo-100 bg-indigo-50/40'
          : stage.status === 'in_progress'
            ? 'border-[#ff4500]/30 bg-orange-50/40'
            : 'border-[#edeff1] bg-white'
      }`}
    >
      <div className="mb-2 flex w-full items-center justify-between">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${BADGE[stage.status]}`}>
          {stage.status === 'completed' ? <Check size={13} /> : index + 1}
        </span>
        {(isFirst || isLast) && (
          <span className={`text-[10px] font-semibold ${isLast ? 'text-indigo-600' : 'text-[#878a8c]'}`}>
            {isFirst ? 'Current' : 'Target'}
          </span>
        )}
      </div>

      <span className={`mb-2 grid h-9 w-9 place-items-center rounded-lg ${isLast ? 'bg-white text-indigo-600' : 'bg-gray-50 text-[#878a8c]'}`}>
        <Icon size={18} />
      </span>

      <p className="text-[13px] leading-tight font-semibold text-[#1c1c1c]">{stage.title}</p>

      {stage.durationWeeks ? (
        <p className="mt-1 text-xs text-[#878a8c]">{stage.durationWeeks} weeks</p>
      ) : null}

      {stage.status === 'completed' ? (
        <span className="mt-2 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
          Completed
        </span>
      ) : helpers > 0 ? (
        <button
          onClick={onShowPeople}
          className="mt-2 flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-[#878a8c] transition-colors hover:bg-orange-50 hover:text-[#ff4500]"
          title={`See who: ${stage.title}`}
        >
          <Users size={11} />
          {helpers} alumni can help
        </button>
      ) : null}

      {/* Progress control — the plan is the member's to drive, not a fixed
          script, so every non-bookend stage can be ticked off or paused.
          A stage whose predecessors are unfinished is locked instead: the
          server refuses it either way, so showing a live button here would
          only produce an error toast. */}
      {!isFirst && !isLast && (
        locked ? (
          <span
            title={`Finish "${blockedBy}" first — stages are completed in order.`}
            className="mt-2 flex cursor-not-allowed items-center gap-1 text-[11px] font-semibold text-[#c9ccce]"
          >
            <Lock size={11} />
            Locked
          </span>
        ) : (
          <button
            onClick={() =>
              onStepStatus(stage.stepKey, stage.status === 'completed' ? 'upcoming' : 'completed')
            }
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#ff4500] hover:underline"
          >
            {stage.status === 'completed' ? <CircleDashed size={11} /> : <Check size={11} />}
            {stage.status === 'completed' ? 'Reopen' : 'Mark done'}
          </button>
        )
      )}

      {isFirst && <p className="mt-1.5 text-[11px] text-[#878a8c]">You’re here</p>}
    </div>
  )
}
