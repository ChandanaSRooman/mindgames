import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MapPin, MessageSquare, X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useLayout } from '../components/layout/LayoutContext'
import { Avatar, Button, Card, Pill, SectionTitle } from '../components/ui'
import { matchesUserQuery } from '../lib/search'
import { DOMAINS } from '../types'

export function MyNetwork() {
  const {
    users,
    suggestionIds,
    pendingRequestIds,
    connectionIds,
    sendConnect,
    acceptRequest,
    ignoreRequest,
    connectionState,
    query,
    refreshNetwork,
  } = useApp()
  const { openChatWith } = useLayout()

  const [domainFilter, setDomainFilter] = useState<string>('All')

  // Pull the latest graph on entry so requests sent by others show up.
  useEffect(() => {
    refreshNetwork()
  }, [refreshNetwork])

  const get = (id: string) => users.find((u) => u.id === id)!

  const suggestions = useMemo(
    () =>
      suggestionIds
        .map(get)
        .filter(Boolean)
        .filter((u) => matchesUserQuery(u, query))
        .filter((u) => domainFilter === 'All' || u.domain === domainFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestionIds, users, query, domainFilter],
  )

  const pending = pendingRequestIds.map(get).filter(Boolean)
  const connections = connectionIds.map(get).filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-[#1c1c1c]">My Network</h1>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <SectionTitle>Connection Requests ({pending.length})</SectionTitle>
          <div className="flex flex-col gap-3">
            {pending.map((u) => (
              <Card key={u.id} className="flex items-center gap-3 p-4">
                <Avatar name={u.name} size={48} to={`/profile/${u.id}`} />
                <div className="min-w-0 flex-1">
                  <Link to={`/profile/${u.id}`} className="font-semibold text-[#1c1c1c] hover:underline">
                    {u.name}
                  </Link>
                  <p className="truncate text-xs text-[#878a8c]">{u.designation} · {u.company}</p>
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
      )}

      {/* People you may know */}
      <section>
        <SectionTitle>People You May Know</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-2">
          <Pill active={domainFilter === 'All'} onClick={() => setDomainFilter('All')}>All</Pill>
          {DOMAINS.map((d) => (
            <Pill key={d} active={domainFilter === d} onClick={() => setDomainFilter(d)}>
              {d}
            </Pill>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((u) => (
            <Card key={u.id} className="flex flex-col items-center p-5 text-center">
              <Avatar name={u.name} size={64} to={`/profile/${u.id}`} />
              <Link to={`/profile/${u.id}`} className="mt-3 font-semibold text-[#1c1c1c] hover:underline">
                {u.name}
              </Link>
              <p className="text-xs text-[#878a8c]">{u.designation} · {u.company}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#878a8c]">
                <MapPin size={12} /> {u.city} · Batch {u.batchYear}
              </p>
              <Button
                variant={connectionState(u.id) === 'pending' ? 'subtle' : 'outline'}
                className="mt-3 w-full"
                disabled={connectionState(u.id) === 'pending'}
                onClick={() => sendConnect(u.id)}
              >
                {connectionState(u.id) === 'pending' ? 'Request sent' : 'Connect'}
              </Button>
            </Card>
          ))}
          {suggestions.length === 0 && (
            <p className="text-sm text-[#878a8c]">No suggestions match your filters.</p>
          )}
        </div>
      </section>

      {/* Your connections */}
      <section>
        <SectionTitle>Your Connections ({connections.length})</SectionTitle>
        <div className="flex flex-col gap-3">
          {connections.map((u) => (
            <Card key={u.id} className="flex items-center gap-3 p-4">
              <Avatar name={u.name} size={48} to={`/profile/${u.id}`} />
              <div className="min-w-0 flex-1">
                <Link to={`/profile/${u.id}`} className="font-semibold text-[#1c1c1c] hover:underline">
                  {u.name}
                </Link>
                <p className="truncate text-xs text-[#878a8c]">{u.designation} · {u.company}</p>
              </div>
              <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => openChatWith(u.id)}>
                <MessageSquare size={15} /> Message
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
