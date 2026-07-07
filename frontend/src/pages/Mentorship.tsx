import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Calendar, GraduationCap, Star, X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Avatar, Button, Card } from '../components/ui'
import type { User } from '../types'

type Tab = 'Find a Mentor' | 'My Sessions'

export function Mentorship() {
  const {
    users,
    currentUser,
    sessions,
    userById,
    bookSession,
    acceptSession,
    declineSession,
    completeSession,
    becomeMentor,
    query,
  } = useApp()
  const [tab, setTab] = useState<Tab>('Find a Mentor')
  const [booking, setBooking] = useState<User | null>(null)
  const [showBecome, setShowBecome] = useState(false)

  const q = query.trim().toLowerCase()
  const mentors = users
    .filter((u) => u.isMentor && u.id !== currentUser.id && u.id !== 'rooman')
    .filter((u) => !q || `${u.name} ${u.domain} ${u.expertise.join(' ')}`.toLowerCase().includes(q))

  const requested = sessions.filter((s) => s.status === 'requested')
  const upcoming = sessions.filter((s) => s.status === 'upcoming')
  const finished = sessions.filter((s) => s.status === 'past' || s.status === 'declined')

  // Mentors I already have a pending request with (as the mentee).
  const pendingMentorRequestIds = new Set(
    sessions
      .filter((s) => s.status === 'requested' && s.menteeId === currentUser.id)
      .map((s) => s.mentorId),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1c1c1c]">Mentorship</h1>
        {!currentUser.isMentor && (
          <Button variant="outline" onClick={() => setShowBecome(true)}>
            <Award size={16} /> Become a Mentor
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#edeff1] bg-white p-1 shadow-sm">
        {(['Find a Mentor', 'My Sessions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t ? 'bg-[#ff4500] text-white' : 'text-[#878a8c] hover:bg-gray-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Find a Mentor' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {mentors.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} size={56} to={`/profile/${m.id}`} />
                <div className="min-w-0">
                  <Link to={`/profile/${m.id}`} className="font-semibold text-[#1c1c1c] hover:underline">{m.name}</Link>
                  <p className="truncate text-xs text-[#878a8c]">{m.designation} · {m.company}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-[#ff4500]">{m.domain}</span>
                {m.expertise.slice(0, 2).map((e) => (
                  <span key={e} className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{e}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-[#878a8c]">
                  <Star size={14} className="fill-amber-400 text-amber-400" /> {m.sessionsConducted ?? 0} sessions
                </span>
                {m.mentorRate ? (
                  <span className="font-bold text-[#1c1c1c]">₹{m.mentorRate.toLocaleString('en-IN')}<span className="text-xs font-normal text-[#878a8c]">/hr</span></span>
                ) : (
                  <span className="text-xs text-[#878a8c]">Rate on request</span>
                )}
              </div>
              {pendingMentorRequestIds.has(m.id) ? (
                <Button variant="subtle" className="mt-4 w-full" disabled>
                  <Calendar size={15} /> Requested — awaiting confirmation
                </Button>
              ) : (
                <Button className="mt-4 w-full" onClick={() => setBooking(m)}>
                  <Calendar size={15} /> Book a Session
                </Button>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Requests: mentor decides; mentee awaits */}
          {requested.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">Requests</h2>
              <div className="flex flex-col gap-3">
                {requested.map((s) => {
                  const iAmMentor = s.mentorId === currentUser.id
                  const other = iAmMentor ? s.menteeName : userById(s.mentorId)?.name
                  return (
                    <Card key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <GraduationCap size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#1c1c1c]">{s.topic}</p>
                        <p className="text-xs text-[#878a8c]">
                          {iAmMentor ? `${other} requested this session` : `with ${other}`} · {s.date} · {s.time}
                        </p>
                      </div>
                      {iAmMentor ? (
                        <div className="flex gap-2">
                          <Button className="!px-3 !py-1.5 text-xs" onClick={() => acceptSession(s.id)}>
                            Accept
                          </Button>
                          <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => declineSession(s.id)}>
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Awaiting confirmation
                        </span>
                      )}
                    </Card>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">Upcoming</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map((s) => {
                const iAmMentor = s.mentorId === currentUser.id
                const other = iAmMentor ? s.menteeName : userById(s.mentorId)?.name
                return (
                  <Card key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-[#ff4500]">
                      <GraduationCap size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#1c1c1c]">{s.topic}</p>
                      <p className="text-xs text-[#878a8c]">
                        {iAmMentor ? 'mentoring' : 'with'} {other} · {s.date} · {s.time}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Confirmed</span>
                    {iAmMentor && (
                      <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => completeSession(s.id)}>
                        Mark completed
                      </Button>
                    )}
                  </Card>
                )
              })}
              {upcoming.length === 0 && <Empty label="No upcoming sessions." />}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">Past</h2>
            <div className="flex flex-col gap-3">
              {finished.map((s) => {
                const iAmMentor = s.mentorId === currentUser.id
                const other = iAmMentor ? s.menteeName : userById(s.mentorId)?.name
                const declined = s.status === 'declined'
                return (
                  <Card key={s.id} className="flex items-center gap-3 p-4 opacity-80">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-[#878a8c]">
                      <GraduationCap size={20} />
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-[#1c1c1c]">{s.topic}</p>
                      <p className="text-xs text-[#878a8c]">{iAmMentor ? 'mentored' : 'with'} {other} · {s.date}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${declined ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-[#878a8c]'}`}>
                      {declined ? 'Declined' : 'Completed'}
                    </span>
                  </Card>
                )
              })}
              {finished.length === 0 && <Empty label="No past sessions." />}
            </div>
          </section>
        </div>
      )}

      {booking && (
        <BookModal
          mentor={booking}
          onClose={() => setBooking(null)}
          onBook={(topic, date, time) => {
            bookSession(booking.id, topic, date, time)
            setBooking(null)
            // Land the user on My Sessions so the new request is visible.
            setTab('My Sessions')
          }}
        />
      )}
      {showBecome && <BecomeMentorModal onClose={() => setShowBecome(false)} onConfirm={(rate) => { becomeMentor(rate); setShowBecome(false) }} />}
    </div>
  )
}

// Booking requires a topic, date and time — the mentor gets all three in the
// session request + notification.
function BookModal({
  mentor,
  onClose,
  onBook,
}: {
  mentor: User
  onClose: () => void
  onBook: (topic: string, date: string, time: string) => void
}) {
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)

  const field =
    'mt-1 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]'

  function submit() {
    if (!topic.trim()) return setError('Tell the mentor what you want to discuss.')
    if (!date) return setError('Pick a date for the session.')
    if (!time) return setError('Pick a time for the session.')
    // Human-readable labels, e.g. "Mon, 6 Jul 2026" and "6:00 pm IST".
    const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
    const timeLabel =
      new Date(`${date}T${time}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' IST'
    onBook(topic.trim(), dateLabel, timeLabel)
  }

  return (
    <Overlay onClose={onClose} title={`Book a session with ${mentor.name}`}>
      <p className="text-sm text-[#878a8c]">
        {mentor.designation}
        {mentor.mentorRate ? ` · ₹${mentor.mentorRate.toLocaleString('en-IN')}/hr` : ' · rate on request'}
      </p>
      <label className="mt-4 block text-sm font-medium text-[#1c1c1c]">What would you like to discuss? *</label>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={3}
        placeholder="e.g. System design interview prep"
        className={`${field} resize-none`}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#1c1c1c]">Date *</label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1c1c1c]">Time *</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <Button className="mt-4 w-full" onClick={submit}>Request Session</Button>
    </Overlay>
  )
}

function BecomeMentorModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (rate: number) => void }) {
  const [rate, setRate] = useState('1000')
  return (
    <Overlay onClose={onClose} title="Become a Mentor">
      <p className="text-sm text-[#878a8c]">Get listed as a mentor and conduct paid sessions for the network.</p>
      <label className="mt-4 block text-sm font-medium text-[#1c1c1c]">Your hourly rate (₹)</label>
      <input
        value={rate}
        onChange={(e) => setRate(e.target.value.replace(/\D/g, ''))}
        className="mt-1 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
      />
      <Button className="mt-4 w-full" onClick={() => onConfirm(Number(rate) || 1000)}>List me as a Mentor</Button>
    </Overlay>
  )
}

function Overlay({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="animate-slidein w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1c1c1c]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border border-[#edeff1] bg-white py-10 text-center text-sm text-[#878a8c] shadow-sm">{label}</div>
}
