import { useOutletContext } from 'react-router-dom'
import { Briefcase, Check, GraduationCap, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Button, Card, SectionTitle } from '../../components/ui'
import type { Post, User } from '../../types'
import type { NetworkOutletContext } from './NetworkLayout'

// Priority tags on an incoming request: quick signals for why it might be
// worth accepting. "Hiring" = the requester currently has an active job
// post; "Same Batch" = they graduated the same year as you.
function RequestTags({ requester, me, posts }: { requester: User; me: User; posts: Post[] }) {
  const isHiring = posts.some((p) => p.authorId === requester.id && p.type === 'Hiring' && p.active)
  const sameBatch = requester.batchYear === me.batchYear

  if (!isHiring && !sameBatch) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {sameBatch && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
          <GraduationCap size={11} /> Same Batch
        </span>
      )}
      {isHiring && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          <Briefcase size={11} /> Hiring
        </span>
      )}
    </div>
  )
}

export function NetworkRequests() {
  const {
    users,
    currentUser,
    posts,
    pendingRequestIds,
    sentRequestIds,
    acceptRequest,
    ignoreRequest,
    cancelSentRequest,
  } = useApp()
  const { openQuickView } = useOutletContext<NetworkOutletContext>()
  const get = (id: string) => users.find((u) => u.id === id)!
  const pending = pendingRequestIds.map(get).filter(Boolean)
  const sent = sentRequestIds.map(get).filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Connection Requests ({pending.length})</SectionTitle>
        {pending.length === 0 && (
          <p className="text-sm text-[#878a8c]">No pending requests right now.</p>
        )}
        <div className="flex flex-col gap-3">
          {pending.map((u) => (
            <Card key={u.id} className="flex items-center gap-3 p-4">
              <button onClick={() => openQuickView(u.id)}>
                <Avatar name={u.name} src={u.photo} size={48} />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => openQuickView(u.id)}
                  className="font-semibold text-[#1c1c1c] hover:underline"
                >
                  {u.name}
                </button>
                <p className="truncate text-xs text-[#878a8c]">{u.designation} · {u.company}</p>
                <RequestTags requester={u} me={currentUser} posts={posts} />
              </div>
              <Button onClick={() => acceptRequest(u.id)} className="!px-3 !py-1.5 text-xs">
                <Check size={15} /> Accept
              </Button>
              <button
                onClick={() => ignoreRequest(u.id)}
                className="rounded-full p-2 text-[#878a8c] hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Sent Requests ({sent.length})</SectionTitle>
        {sent.length === 0 && (
          <p className="text-sm text-[#878a8c]">You haven't sent any pending requests.</p>
        )}
        <div className="flex flex-col gap-3">
          {sent.map((u) => (
            <Card key={u.id} className="flex items-center gap-3 p-4">
              <button onClick={() => openQuickView(u.id)}>
                <Avatar name={u.name} src={u.photo} size={48} />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => openQuickView(u.id)}
                  className="font-semibold text-[#1c1c1c] hover:underline"
                >
                  {u.name}
                </button>
                <p className="truncate text-xs text-[#878a8c]">{u.designation} · {u.company}</p>
              </div>
              <Button
                variant="ghost"
                className="!px-3 !py-1.5 text-xs !text-red-500 hover:!bg-red-50"
                onClick={() => cancelSentRequest(u.id)}
              >
                Cancel request
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
