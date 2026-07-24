import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Button, Card, Pill, SectionTitle } from '../../components/ui'
import { roleLine } from '../../lib/format'
import { DOMAINS } from '../../types'
import type { NetworkOutletContext } from './NetworkLayout'

// "People You May Know" — filtered only by the domain chips below. This used
// to also silently filter by the global navbar search text (shared app-wide
// state), which made the domain chips look broken whenever leftover text sat
// in the navbar search box. Domain is the only filter here now.
export function NetworkMatches() {
  const { users, suggestionIds, sendConnect, connectionState } = useApp()
  const { openQuickView } = useOutletContext<NetworkOutletContext>()
  const [domainFilter, setDomainFilter] = useState<string>('All')

  const get = (id: string) => users.find((u) => u.id === id)!

  const suggestions = useMemo(
    () =>
      suggestionIds
        .map(get)
        .filter(Boolean)
        .filter((u) => domainFilter === 'All' || u.domain === domainFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestionIds, users, domainFilter],
  )

  return (
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
            <button onClick={() => openQuickView(u.id)}>
              <Avatar name={u.name} src={u.photo} size={64} />
            </button>
            <button
              onClick={() => openQuickView(u.id)}
              className="mt-3 font-semibold text-[#1c1c1c] hover:underline"
            >
              {u.name}
            </button>
            {roleLine(u) && <p className="text-xs text-[#878a8c]">{roleLine(u)}</p>}
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
  )
}
