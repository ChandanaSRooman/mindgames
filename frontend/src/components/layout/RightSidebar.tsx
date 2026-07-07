import { Link } from 'react-router-dom'
import { Briefcase, Calendar } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Button, Card } from '../ui'
import { timeAgo } from '../../lib/format'

export function RightSidebar() {
  const { users, suggestionIds, sendConnect, posts, sessions, userById } = useApp()

  const suggestions = suggestionIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .slice(0, 3) as NonNullable<ReturnType<typeof userById>>[]

  const openings = posts.filter((p) => p.type === 'Hiring').slice(0, 3)
  // Confirmed sessions first, then requests still awaiting the mentor.
  const upcoming = [
    ...sessions.filter((s) => s.status === 'upcoming'),
    ...sessions.filter((s) => s.status === 'requested'),
  ].slice(0, 3)

  return (
    <aside className="fixed bottom-0 right-0 top-14 hidden w-[300px] overflow-y-auto px-4 py-4 xl:block">
      <div className="flex flex-col gap-4">
        {/* People you may know */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1c1c1c]">People You May Know</h3>
            <Link to="/network" className="text-xs font-semibold text-[#ff4500] hover:underline">
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {suggestions.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5">
                <Avatar name={u.name} size={40} to={`/profile/${u.id}`} />
                <div className="min-w-0 flex-1">
                  <Link to={`/profile/${u.id}`} className="block truncate text-sm font-semibold text-[#1c1c1c] hover:underline">
                    {u.name}
                  </Link>
                  <p className="truncate text-xs text-[#878a8c]">
                    {u.designation} · {u.company}
                  </p>
                </div>
                <Button variant="outline" className="!px-3 !py-1 text-xs" onClick={() => sendConnect(u.id)}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Open opportunities */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#1c1c1c]">
              <Briefcase size={16} className="text-[#ff4500]" /> Open Opportunities
            </h3>
            <Link to="/jobs" className="text-xs font-semibold text-[#ff4500] hover:underline">
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {openings.map((p) => {
              const a = userById(p.authorId)
              return (
                <Link key={p.id} to="/jobs" className="block rounded-lg border border-[#edeff1] p-3 hover:border-[#ff4500]">
                  <p className="text-sm font-semibold text-[#1c1c1c]">{p.role ?? 'Open role'}</p>
                  <p className="text-xs text-[#878a8c]">
                    {p.company ?? a?.company} · {p.city ?? 'Remote'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#878a8c]">Posted {timeAgo(p.createdAt)}</p>
                </Link>
              )
            })}
          </div>
        </Card>

        {/* Mentorship sessions */}
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#1c1c1c]">
            <Calendar size={16} className="text-[#ff4500]" /> Upcoming Sessions
          </h3>
          <div className="flex flex-col gap-3">
            {upcoming.map((s) => {
              const m = userById(s.mentorId)
              const pending = s.status === 'requested'
              return (
                <div key={s.id} className="rounded-lg border border-[#edeff1] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1c1c1c]">{s.topic}</p>
                    {pending && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        awaiting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#878a8c]">with {m?.name}</p>
                  <p className="mt-1 text-[11px] font-medium text-[#ff4500]">
                    {s.date} · {s.time}
                  </p>
                </div>
              )
            })}
            {upcoming.length === 0 && (
              <p className="text-xs text-[#878a8c]">No upcoming sessions.</p>
            )}
          </div>
        </Card>

        <p className="px-2 text-[11px] leading-relaxed text-[#878a8c]">
          RooConnect · Rooman Technologies Alumni Network · 25 years · 500,000+ alumni
        </p>
      </div>
    </aside>
  )
}
