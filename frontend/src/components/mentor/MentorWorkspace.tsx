import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award, BadgeCheck, CalendarClock, Clock, Crown, Flame, GraduationCap, Lock,
  Map as MapIcon, Star, Users, Wrench,
} from 'lucide-react'
import { Avatar, Button, Card } from '../ui'
import { api } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import { ManageServicesPanel } from '../career/ManageServicesPanel'
import { MenteeRoadmapModal } from './MenteeRoadmapModal'
import { SubscriptionPlans } from '../subscription/SubscriptionPlans'
import type { Mentee, MentorshipSession, ProfileStats } from '../../types'

/**
 * Everything a mentor needs in one place: who is waiting, who they are
 * helping, what those people are working towards, what they offer, and how
 * they are doing.
 *
 * Locked until an admin approves the mentor application. The locked state is
 * deliberately visible rather than hidden — someone who could mentor should
 * be able to discover that this exists and how to get in.
 */
export function MentorWorkspace({
  requests,
  upcoming,
  finished,
  onAccept,
  onDecline,
  onComplete,
}: {
  requests: MentorshipSession[]
  upcoming: MentorshipSession[]
  /** Sessions this mentor completed or declined — their side of "My
   *  Sessions → Past", which only shows the mentee's own history. */
  finished: MentorshipSession[]
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onComplete: (session: MentorshipSession) => void
}) {
  const { currentUser, subscription } = useApp()
  const [mentees, setMentees] = useState<Mentee[]>([])
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [roadmapFor, setRoadmapFor] = useState<string | null>(null)
  const [showServices, setShowServices] = useState(false)
  const [showPlans, setShowPlans] = useState(false)

  const isMentor = currentUser.isMentor

  useEffect(() => {
    if (!isMentor) return
    api.getMentees().then(setMentees, () => {})
    api.getProfileStats(currentUser.id).then(setStats, () => {})
  }, [isMentor, currentUser.id])

  if (!isMentor) return <LockedState />

  // The banner below renders `blockedReason`, so it should appear exactly
  // when there IS one — i.e. when the mentor cannot currently accept.
  // Deriving it from status instead meant two wrong answers: a mentor who
  // cancelled but still has paid days got a false "you need a subscription"
  // alarm, and a mentor who had used up the month's session cap got no
  // warning at all despite being blocked.
  const canAccept = subscription?.canAcceptSessions ?? false

  return (
    <div className="flex flex-col gap-4">
      {/* Plan banner: the one thing that stops everything else working. */}
      {!canAccept && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Crown size={18} className="shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-900">
            <strong>{subscription?.blockedReason ?? 'You need a subscription to accept sessions.'}</strong>
          </p>
          <Button className="!py-1.5" icon={<Crown size={14} />} onClick={() => setShowPlans(true)}>
            See plans
          </Button>
        </div>
      )}

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<GraduationCap size={16} />} label="Sessions given" value={stats?.sessionsGiven ?? 0} />
        <Stat icon={<Clock size={16} />} label="Hours mentored" value={stats?.hoursGiven ?? 0} />
        <Stat
          icon={<Star size={16} />}
          label="Rating"
          value={stats?.avgRating ? `${stats.avgRating}★` : '—'}
          sub={stats?.ratingCount ? `${stats.ratingCount} rated` : 'no ratings yet'}
        />
        <Stat
          icon={<Flame size={16} />}
          label="Streak"
          value={stats?.mentorStreakWeeks ?? 0}
          sub={stats?.mentorStreakWeeks === 1 ? 'week' : 'weeks'}
        />
      </div>

      {/* Requests waiting on this mentor */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1c1c1c]">
            <CalendarClock size={18} className="text-[#ff4500]" />
            Requests
            {requests.length > 0 && (
              <span className="rounded-full bg-[#ff4500] px-2 py-0.5 text-xs font-bold text-white">
                {requests.length}
              </span>
            )}
          </h2>
        </div>
        {requests.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-[#878a8c]">
            No one is waiting on you right now.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#edeff1] p-3">
                <Avatar name={s.menteeName} size={38} to={`/profile/${s.menteeId}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1c1c1c]">{s.topic}</p>
                  <p className="text-xs text-[#878a8c]">
                    {s.menteeName} · {s.date} at {s.time}
                    {s.isPaid && (s.price ?? 0) > 0 && ` · ₹${(s.price ?? 0).toLocaleString('en-IN')}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" className="!px-3 !py-1.5 !text-xs" onClick={() => onDecline(s.id)}>
                    Decline
                  </Button>
                  <Button className="!px-3 !py-1.5 !text-xs" onClick={() => onAccept(s.id)}>
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Confirmed, still to happen */}
      {upcoming.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1c1c1c]">
            <CalendarClock size={18} className="text-green-600" />
            Upcoming
          </h2>
          <div className="flex flex-col gap-2">
            {upcoming.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#edeff1] p-3">
                <Avatar name={s.menteeName} size={38} to={`/profile/${s.menteeId}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1c1c1c]">{s.topic}</p>
                  <p className="text-xs text-[#878a8c]">
                    {s.menteeName} · {s.date} at {s.time}
                  </p>
                </div>
                {s.meetingLink && (
                  <a
                    href={s.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-semibold text-[#ff4500] hover:underline"
                  >
                    Join
                  </a>
                )}
                <Button className="!px-3 !py-1.5 !text-xs" onClick={() => onComplete(s)}>
                  Mark completed
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Completed or declined — this mentor's own record, since "My
          Sessions → Past" only shows the mentee side of the history. */}
      {finished.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1c1c1c]">
            <GraduationCap size={18} className="text-[#878a8c]" />
            Past
          </h2>
          <div className="flex flex-col gap-2">
            {finished.map((s) => {
              const declined = s.status === 'declined'
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#edeff1] p-3 opacity-80">
                  <Avatar name={s.menteeName} size={38} to={`/profile/${s.menteeId}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1c1c1c]">{s.topic}</p>
                    <p className="text-xs text-[#878a8c]">{s.menteeName} · {s.date}</p>
                  </div>
                  {!declined && s.rating && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                      <Star size={11} className="fill-amber-500 text-amber-500" /> {s.rating}
                    </span>
                  )}
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${declined ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-[#878a8c]'}`}>
                    {declined ? 'Declined' : 'Completed'}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* People being helped */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1c1c1c]">
          <Users size={18} className="text-[#ff4500]" />
          My mentees
        </h2>
        {mentees.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-[#878a8c]">
            Once you accept a session, that member appears here with what they're working towards.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {mentees.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-[#edeff1] p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.name} src={m.photo} size={38} to={`/profile/${m.id}`} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/profile/${m.id}`} className="block truncate text-sm font-bold text-[#1c1c1c] hover:underline">
                      {m.name}
                    </Link>
                    <p className="truncate text-xs text-[#878a8c]">
                      {[m.designation, m.company].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-[#878a8c]">
                    {m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}
                  </span>
                </div>

                {m.goal?.targetRole && (
                  <p className="flex items-center gap-1.5 text-xs text-[#878a8c]">
                    <MapIcon size={12} className="shrink-0 text-[#ff4500]" />
                    Working towards <strong className="text-[#1c1c1c]">{m.goal.targetRole}</strong>
                  </p>
                )}

                {m.hasRoadmap ? (
                  <Button
                    variant="outline"
                    className="!py-1.5 !text-xs"
                    icon={<MapIcon size={13} />}
                    onClick={() => setRoadmapFor(m.id)}
                  >
                    View their roadmap
                  </Button>
                ) : (
                  <span className="rounded-lg bg-gray-50 py-1.5 text-center text-xs text-[#878a8c]">
                    No roadmap yet
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* What they offer + what they've earned */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#1c1c1c]">
            <Wrench size={18} className="text-[#ff4500]" />
            My services
          </h2>
          <p className="mb-3 text-sm text-[#878a8c]">
            What you offer, and what you charge. Shown to members whose roadmap matches.
          </p>
          <Button variant="outline" onClick={() => setShowServices((v) => !v)}>
            {showServices ? 'Hide services' : 'Manage services'}
          </Button>
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#1c1c1c]">
            <Award size={18} className="text-[#ff4500]" />
            Badges
          </h2>
          {!stats || stats.badges.length === 0 ? (
            <p className="text-sm text-[#878a8c]">
              Complete a session and have your mentee confirm it to earn your first badge.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.badges.map((b) => (
                <span
                  key={b.id}
                  title={b.description}
                  className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                >
                  <BadgeCheck size={13} />
                  {b.name}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showServices && <ManageServicesPanel onClose={() => setShowServices(false)} />}
      {roadmapFor && <MenteeRoadmapModal menteeId={roadmapFor} onClose={() => setRoadmapFor(null)} />}
      {showPlans && (
        <SubscriptionPlans reason="You need a subscription to accept sessions" onClose={() => setShowPlans(false)} />
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  sub?: string
}) {
  return (
    <Card className="p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-[#878a8c]">
        <span className="text-[#ff4500]">{icon}</span>
        {label}
      </span>
      <p className="mt-1 text-2xl font-bold text-[#1c1c1c]">{value}</p>
      {sub && <p className="text-xs text-[#878a8c]">{sub}</p>}
    </Card>
  )
}

/** Shown to anyone who is not an approved mentor. Explains what the space is
 *  and points at the real application, rather than hiding the tab entirely. */
function LockedState() {
  return (
    <Card className="px-6 py-12 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-[#878a8c]">
        <Lock size={26} />
      </span>
      <h2 className="text-xl font-bold text-[#1c1c1c]">Your mentor space is locked</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[#878a8c]">
        Once an admin verifies you as a mentor, this is where you'll handle session requests,
        see who you're helping and what they're working towards, and manage what you offer.
      </p>

      <div className="mx-auto mt-6 grid max-w-xl gap-2 text-left sm:grid-cols-2">
        {[
          'Accept or decline session requests',
          'See each mentee’s career roadmap',
          'List services and set your own price',
          'Track sessions, hours, ratings and badges',
        ].map((f) => (
          <p key={f} className="flex items-center gap-2 rounded-lg border border-[#edeff1] px-3 py-2 text-sm text-[#878a8c]">
            <Lock size={12} className="shrink-0" />
            {f}
          </p>
        ))}
      </div>

      <Link to="/profile">
        <Button className="mx-auto mt-6" icon={<Award size={14} />}>
          Apply to become a mentor
        </Button>
      </Link>
      <p className="mt-2 text-xs text-[#878a8c]">
        Applications are submitted from your profile, with proof of your experience.
      </p>
    </Card>
  )
}
