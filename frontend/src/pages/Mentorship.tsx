import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Calendar, GraduationCap, Star, X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Avatar, Button, Card } from '../components/ui'
import type { User } from '../types'

type Tab = 'Find a Mentor' | 'My Sessions'

export function Mentorship() {
  const { users, currentUser, sessions, userById, bookSession, becomeMentor, query } = useApp()
  const [tab, setTab] = useState<Tab>('Find a Mentor')
  const [booking, setBooking] = useState<User | null>(null)
  const [showBecome, setShowBecome] = useState(false)

  const q = query.trim().toLowerCase()
  const mentors = users
    .filter((u) => u.isMentor && u.id !== 'me')
    .filter((u) => !q || `${u.name} ${u.domain} ${u.expertise.join(' ')}`.toLowerCase().includes(q))

  const upcoming = sessions.filter((s) => s.status === 'upcoming')
  const past = sessions.filter((s) => s.status === 'past')

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
                  <Star size={14} className="fill-amber-400 text-amber-400" /> {m.sessionsConducted} sessions
                </span>
                <span className="font-bold text-[#1c1c1c]">₹{m.mentorRate?.toLocaleString('en-IN')}<span className="text-xs font-normal text-[#878a8c]">/hr</span></span>
              </div>
              <Button className="mt-4 w-full" onClick={() => setBooking(m)}>
                <Calendar size={15} /> Book a Session
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">Upcoming</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map((s) => {
                const m = userById(s.mentorId)
                return (
                  <Card key={s.id} className="flex items-center gap-3 p-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-[#ff4500]">
                      <GraduationCap size={20} />
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-[#1c1c1c]">{s.topic}</p>
                      <p className="text-xs text-[#878a8c]">with {m?.name} · {s.date} · {s.time}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Confirmed</span>
                  </Card>
                )
              })}
              {upcoming.length === 0 && <Empty label="No upcoming sessions." />}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">Past</h2>
            <div className="flex flex-col gap-3">
              {past.map((s) => {
                const m = userById(s.mentorId)
                return (
                  <Card key={s.id} className="flex items-center gap-3 p-4 opacity-80">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-[#878a8c]">
                      <GraduationCap size={20} />
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-[#1c1c1c]">{s.topic}</p>
                      <p className="text-xs text-[#878a8c]">with {m?.name} · {s.date}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-[#878a8c]">Completed</span>
                  </Card>
                )
              })}
              {past.length === 0 && <Empty label="No past sessions." />}
            </div>
          </section>
        </div>
      )}

      {booking && <BookModal mentor={booking} onClose={() => setBooking(null)} onBook={(topic) => { bookSession(booking.id, topic); setBooking(null) }} />}
      {showBecome && <BecomeMentorModal onClose={() => setShowBecome(false)} onConfirm={(rate) => { becomeMentor(rate); setShowBecome(false) }} />}
    </div>
  )
}

function BookModal({ mentor, onClose, onBook }: { mentor: User; onClose: () => void; onBook: (topic: string) => void }) {
  const [topic, setTopic] = useState('')
  return (
    <Overlay onClose={onClose} title={`Book a session with ${mentor.name}`}>
      <p className="text-sm text-[#878a8c]">{mentor.designation} · ₹{mentor.mentorRate?.toLocaleString('en-IN')}/hr</p>
      <label className="mt-4 block text-sm font-medium text-[#1c1c1c]">What would you like to discuss?</label>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={3}
        placeholder="e.g. System design interview prep"
        className="mt-1 w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
      />
      <Button className="mt-4 w-full" onClick={() => onBook(topic)}>Request Session</Button>
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
