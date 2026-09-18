import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Briefcase, Compass, Pencil, Route, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { CareerAssessmentWizard } from '../components/career/CareerAssessmentWizard'
import { CareerGoalSummary } from '../components/career/CareerGoalSummary'
import { CareerRoadmapTimeline } from '../components/career/CareerRoadmapTimeline'
import { AlumniHelpSection } from '../components/career/AlumniHelpSection'
import { MatchedServices } from '../components/career/MatchedServices'
import { NextStepCard, QuickAccessCard } from '../components/career/NextStepCard'
import { ManageServicesPanel } from '../components/career/ManageServicesPanel'
import { EditRoadmapPanel } from '../components/career/EditRoadmapPanel'
import { serviceName } from '../lib/careerServices'
import type {
  AlumniHelper,
  AlumniService,
  CareerAssessment,
  CareerRoadmap,
  CareerStageStatus,
} from '../types'

type BookingTarget =
  | { kind: 'person'; mentorId: string; name: string; topic: string }
  | { kind: 'service'; mentorId: string; name: string; topic: string; serviceId: string }

/**
 * Career Guidance: the assessment → roadmap → alumni/services flow.
 *
 * This page orchestrates existing features rather than duplicating them —
 * people, jobs and mentors all link back out to the pages that already own
 * them (see QuickAccessCard).
 */
export function CareerGuidance() {
  const { currentUser, bookSession, notify } = useApp()
  const navigate = useNavigate()

  const [roadmap, setRoadmap] = useState<CareerRoadmap | null>(null)
  const [assessment, setAssessment] = useState<CareerAssessment | null>(null)
  const [draft, setDraft] = useState<CareerAssessment | null>(null)
  const [helpers, setHelpers] = useState<AlumniHelper[]>([])
  const [matched, setMatched] = useState<AlumniService[]>([])
  const [allServices, setAllServices] = useState<AlumniService[] | null>(null)
  const [showingAll, setShowingAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [wizard, setWizard] = useState(false)
  const [editingRoadmap, setEditingRoadmap] = useState(false)
  const [managing, setManaging] = useState(false)
  const [booking, setBooking] = useState<BookingTarget | null>(null)

  const loadRoadmapExtras = useCallback(() => {
    Promise.all([api.getCareerAlumniHelp(), api.getMatchedServices()])
      .then(([people, services]) => {
        setHelpers(people)
        setMatched(services)
      })
      .catch(() => {
        /* the roadmap itself still renders without these side panels */
      })
  }, [])

  useEffect(() => {
    Promise.all([api.getCareerRoadmap(), api.getLastCareerAssessment(), api.getCareerDraft()])
      .then(([r, last, d]) => {
        setRoadmap(r)
        setAssessment(last)
        setDraft(d)
        if (r) loadRoadmapExtras()
      })
      .catch((err) => notify(err instanceof Error ? err.message : 'Could not load Career Guidance.', 'error'))
      .finally(() => setLoading(false))
  }, [notify, loadRoadmapExtras])

  async function setStepStatus(stepKey: string, status: CareerStageStatus) {
    try {
      setRoadmap(await api.setCareerStepStatus(stepKey, status))
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update that step.', 'error')
    }
  }

  async function toggleAllServices() {
    if (!showingAll && allServices === null) {
      try {
        setAllServices(await api.getAllServices())
      } catch {
        notify('Could not load the full service list.', 'error')
        return
      }
    }
    setShowingAll((v) => !v)
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff4500] border-t-transparent" />
      </div>
    )
  }

  if (wizard) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader onBack={() => setWizard(false)} />
        <CareerAssessmentWizard
          initial={draft ?? assessment}
          onCancel={() => setWizard(false)}
          onDone={(r) => {
            setRoadmap(r)
            setDraft(null)
            setWizard(false)
            loadRoadmapExtras()
            api.getLastCareerAssessment().then(setAssessment).catch(() => {})
            notify('Your roadmap is ready.', 'success')
          }}
        />
      </div>
    )
  }

  if (!roadmap) {
    return (
      <div className="flex flex-col gap-4">
        {/* A mentor manages what they offer from here too. Without this the
            supply side would be gated behind the demand side: a mentor who
            never takes the assessment could never list a service. */}
        <PageHeader
          onBack={() => navigate(-1)}
          actions={
            currentUser.isMentor ? (
              <Button variant="outline" icon={<Briefcase size={14} />} onClick={() => setManaging((v) => !v)}>
                My services
              </Button>
            ) : undefined
          }
        />
        {managing && <ManageServicesPanel onClose={() => setManaging(false)} />}
        <EmptyState hasDraft={!!draft} onStart={() => setWizard(true)} />
      </div>
    )
  }

  const nextStage = roadmap.stages.find((s) => s.status === 'in_progress' || s.status === 'upcoming')
  const services = showingAll ? allServices ?? [] : matched

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        onBack={() => navigate(-1)}
        actions={
          <>
            <Button variant="outline" icon={<Pencil size={14} />} onClick={() => setWizard(true)}>
              Edit assessment
            </Button>
            <Button
              variant="outline"
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setEditingRoadmap((v) => !v)}
            >
              Edit roadmap
            </Button>
            {currentUser.isMentor && (
              <Button variant="outline" icon={<Briefcase size={14} />} onClick={() => setManaging((v) => !v)}>
                My services
              </Button>
            )}
          </>
        }
      />

      {editingRoadmap && (
        <EditRoadmapPanel
          roadmap={roadmap}
          onClose={() => setEditingRoadmap(false)}
          onSaved={(r) => {
            setRoadmap(r)
            loadRoadmapExtras()
          }}
        />
      )}

      {managing && <ManageServicesPanel onClose={() => setManaging(false)} />}

      <CareerGoalSummary roadmap={roadmap} supportPreference={assessment?.supportPreference ?? ''} />

      <CareerRoadmapTimeline roadmap={roadmap} onStepStatus={setStepStatus} />

      <AlumniHelpSection
        people={helpers}
        onBook={(p) =>
          setBooking({
            kind: 'person',
            mentorId: p.id,
            name: p.name,
            topic: p.reason || `Guidance towards ${roadmap.goal.targetRole ?? 'my career goal'}`,
          })
        }
      />

      <MatchedServices
        services={services}
        showingAll={showingAll}
        onToggleAll={toggleAllServices}
        onBook={(s) =>
          setBooking({
            kind: 'service',
            mentorId: s.userId,
            name: s.providerName ?? 'this alumnus',
            topic: serviceName(s),
            serviceId: s.id,
          })
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextStepCard
            stage={nextStage}
            onFindAlumni={() => {
              const el = document.getElementById('career-alumni-help')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
              else navigate('/network/matches')
            }}
          />
        </div>
        <QuickAccessCard />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#edeff1] bg-white px-5 py-4">
        <p className="text-sm">
          <span className="font-bold text-[#1c1c1c]">Your network is your net worth.</span>
          <span className="block text-[#878a8c]">
            Tap into the Rooman alumni community and build the career you want.
          </span>
        </p>
        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ff4500] text-sm font-bold text-white">
            R
          </span>
          <span className="text-xs leading-tight font-bold text-[#1c1c1c]">
            RooConnect
            <span className="block font-medium text-[#878a8c]">Alumni Network</span>
          </span>
        </span>
      </div>

      {booking && (
        <BookModal
          target={booking}
          onClose={() => setBooking(null)}
          onBook={(topic, date, time) => {
            bookSession(
              booking.mentorId,
              topic,
              date,
              time,
              booking.kind === 'service' ? booking.serviceId : undefined,
            )
            setBooking(null)
          }}
        />
      )}
    </div>
  )
}

function PageHeader({ onBack, actions }: { onBack: () => void; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <button
          onClick={onBack}
          className="mt-1 rounded-full p-1 text-[#878a8c] hover:bg-gray-100"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1c1c1c]">Your Career Roadmap</h1>
          <p className="text-sm text-[#878a8c]">
            Built from your goals, skills, time, and the kind of help you want.
          </p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

function EmptyState({ hasDraft, onStart }: { hasDraft: boolean; onStart: () => void }) {
  return (
    <Card className="px-6 py-12 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
        <Route size={26} />
      </span>
      <h2 className="text-xl font-bold text-[#1c1c1c]">
        {hasDraft ? 'Pick up where you left off' : 'Build your career roadmap'}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[#878a8c]">
        Answer a few questions about where you are and where you want to go. We’ll build a
        step-by-step plan and connect you with Rooman alumni who’ve walked a similar path.
      </p>

      <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
        <Perk icon={<Compass size={18} />} title="A plan for your goal" body="Stages sized to the time you actually have." />
        <Perk icon={<Sparkles size={18} />} title="Alumni who fit" body="People who made a similar move before you." />
        <Perk icon={<Briefcase size={18} />} title="Help you can book" body="Guidance and services matched to each stage." />
      </div>

      <Button className="mx-auto mt-6" icon={<Sparkles size={14} />} onClick={onStart}>
        {hasDraft ? 'Resume assessment' : 'Start assessment'}
      </Button>
      <p className="mt-2 text-xs text-[#878a8c]">Takes about 5–10 minutes. Your progress is saved.</p>
    </Card>
  )
}

function Perk({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#edeff1] p-4 text-left">
      <span className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-[#ff4500]">
        {icon}
      </span>
      <p className="text-sm font-bold text-[#1c1c1c]">{title}</p>
      <p className="text-xs text-[#878a8c]">{body}</p>
    </div>
  )
}

/** Booking reuses the existing mentorship session flow — topic, date and
 *  time, exactly as Mentorship does. A service booking additionally carries
 *  its service id so the session snapshots that service's price. */
function BookModal({
  target,
  onClose,
  onBook,
}: {
  target: BookingTarget
  onClose: () => void
  onBook: (topic: string, date: string, time: string) => void
}) {
  const [topic, setTopic] = useState(target.topic)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      {/* The click guard wraps the whole Card. On an inner div, clicking the
          Card's own p-5 padding still reached the backdrop handler and closed
          the modal, discarding whatever had been typed. */}
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="w-full p-5">
          <div>
          <h2 className="text-lg font-bold text-[#1c1c1c]">Request a session with {target.name}</h2>
          <p className="mb-4 text-sm text-[#878a8c]">
            They’ll get your request and confirm a time. Payment, if any, is arranged directly with them.
          </p>

          <label className="mb-1 block text-xs font-semibold text-[#878a8c]">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
          />

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#878a8c]">Preferred date</label>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="Mon, 12 Oct"
                className="w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#878a8c]">Preferred time</label>
              <input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="6:00 PM IST"
                className="w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!topic.trim() || !date.trim() || !time.trim()}
              onClick={() => onBook(topic.trim(), date.trim(), time.trim())}
            >
              Send request
            </Button>
          </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
