import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Check, ChevronDown, MapPin, MessageSquare, Send, Users } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useLayout } from '../components/layout/LayoutContext'
import { api } from '../lib/api'
import { Avatar, Button, Card, Pill } from '../components/ui'
import { timeAgo } from '../lib/format'
import { DOMAINS, type Domain, type JobApplicant, type Post } from '../types'

type Tab = 'Hiring' | 'Open to Work'

export function Jobs() {
  const { posts, users, userById, query, sendConnect, connectionState, currentUser, applyToJob } = useApp()
  const [tab, setTab] = useState<Tab>('Hiring')
  const [domain, setDomain] = useState<Domain | 'All'>('All')

  const q = query.trim().toLowerCase()

  const hiring = useMemo(
    () =>
      posts
        .filter((p) => p.type === 'Hiring')
        .filter((p) => domain === 'All' || p.domain === domain)
        .filter((p) => !q || `${p.role} ${p.company} ${p.content}`.toLowerCase().includes(q)),
    [posts, domain, q],
  )

  // "Open to work" people: anyone employmentType Looking + those who posted Open to Work.
  const openToWork = useMemo(() => {
    const fromPosts = posts.filter((p) => p.type === 'Open to Work').map((p) => p.authorId)
    const fromStatus = users.filter((u) => u.employmentType === 'Looking for opportunity').map((u) => u.id)
    const ids = Array.from(new Set([...fromPosts, ...fromStatus])).filter((id) => id !== currentUser.id)
    return ids
      .map((id) => userById(id))
      .filter(Boolean)
      .filter((u) => domain === 'All' || u!.domain === domain)
      .filter((u) => !q || `${u!.name} ${u!.designation} ${u!.domain} ${u!.city}`.toLowerCase().includes(q)) as NonNullable<
      ReturnType<typeof userById>
    >[]
  }, [posts, users, userById, domain, q, currentUser.id])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-[#1c1c1c]">Jobs & Opportunities</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#edeff1] bg-white p-1 shadow-sm">
        {(['Hiring', 'Open to Work'] as Tab[]).map((t) => (
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

      {/* Domain filter */}
      <div className="flex flex-wrap gap-2">
        <Pill active={domain === 'All'} onClick={() => setDomain('All')}>All Domains</Pill>
        {DOMAINS.map((d) => (
          <Pill key={d} active={domain === d} onClick={() => setDomain(d)}>{d}</Pill>
        ))}
      </div>

      {tab === 'Hiring' ? (
        <div className="flex flex-col gap-3">
          {hiring.map((p) => (
            <HiringCard
              key={p.id}
              post={p}
              isMine={p.authorId === currentUser.id}
              author={userById(p.authorId)}
              onApply={() => applyToJob(p.id)}
            />
          ))}
          {hiring.length === 0 && <Empty label="No hiring posts match your filters." />}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openToWork.map((u) => (
            <Card key={u.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} size={52} to={`/profile/${u.id}`} />
                <div className="min-w-0">
                  <Link to={`/profile/${u.id}`} className="font-semibold text-[#1c1c1c] hover:underline">{u.name}</Link>
                  <p className="truncate text-xs text-[#878a8c]">{u.designation}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Open to Work</span>
                <span className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{u.domain}</span>
                <span className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{u.experienceYears} yrs</span>
                <span className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{u.city}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-[#878a8c]">{u.bio}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                disabled={connectionState(u.id) !== 'none'}
                onClick={() => sendConnect(u.id)}
              >
                {connectionState(u.id) === 'connected' ? 'Connected' : connectionState(u.id) === 'pending' ? 'Request sent' : 'Connect'}
              </Button>
            </Card>
          ))}
          {openToWork.length === 0 && <Empty label="No alumni open to work match your filters." />}
        </div>
      )}
    </div>
  )
}

function HiringCard({
  post: p,
  isMine,
  author,
  onApply,
}: {
  post: Post
  isMine: boolean
  author?: { id: string; name: string; company: string }
  onApply: () => void
}) {
  const { openChatWith } = useLayout()
  const [applicants, setApplicants] = useState<JobApplicant[] | null>(null)
  const [showApplicants, setShowApplicants] = useState(false)

  // Poster-only: load the applicant list on first expand.
  async function toggleApplicants() {
    const next = !showApplicants
    setShowApplicants(next)
    if (next && applicants === null) {
      try {
        setApplicants(await api.getApplicants(p.id))
      } catch {
        setApplicants([])
      }
    }
  }

  const count = p.applicantsCount ?? 0

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#1c1c1c]">{p.role ?? 'Open Role'}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-[#878a8c]">
            <span className="flex items-center gap-1"><Briefcase size={14} /> {p.company ?? author?.company}</span>
            {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>}
            {p.domain && <span>· {p.domain}</span>}
          </p>
        </div>
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
          Hiring
        </span>
      </div>
      <p className="mt-3 text-sm text-[#1c1c1c]">{p.content}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Link to={`/profile/${author?.id}`} className="flex items-center gap-2 text-sm hover:underline">
          <Avatar name={author?.name ?? '?'} size={32} />
          <span className="text-[#878a8c]">Posted by <span className="font-medium text-[#1c1c1c]">{author?.name}</span> · {timeAgo(p.createdAt)}</span>
        </Link>

        {isMine ? (
          <Button variant="outline" onClick={toggleApplicants}>
            <Users size={15} /> {count} applicant{count === 1 ? '' : 's'}
            <ChevronDown size={14} className={`transition-transform ${showApplicants ? 'rotate-180' : ''}`} />
          </Button>
        ) : p.appliedByMe ? (
          <Button variant="subtle" disabled>
            <Check size={15} /> Applied
          </Button>
        ) : (
          <Button onClick={onApply}>
            <Send size={15} /> Apply
          </Button>
        )}
      </div>

      {/* Applicant list — visible only to the poster */}
      {isMine && showApplicants && (
        <div className="mt-4 border-t border-[#edeff1] pt-3">
          {applicants === null ? (
            <p className="text-sm text-[#878a8c]">Loading applicants…</p>
          ) : applicants.length === 0 ? (
            <p className="text-sm text-[#878a8c]">No applications yet. Share the post to reach more alumni.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {applicants.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-[#edeff1] p-2.5">
                  <Avatar name={a.name} size={36} to={`/profile/${a.id}`} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/profile/${a.id}`} className="text-sm font-semibold text-[#1c1c1c] hover:underline">
                      {a.name}
                    </Link>
                    <p className="truncate text-xs text-[#878a8c]">
                      {a.designation}{a.company ? ` · ${a.company}` : ''}{a.city ? ` · ${a.city}` : ''} · applied {timeAgo(a.appliedAt)}
                    </p>
                  </div>
                  <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => openChatWith(a.id)}>
                    <MessageSquare size={14} /> Message
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
      {label}
    </div>
  )
}
