import { useOutletContext } from 'react-router-dom'
import { MapPin, MessageSquare } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { useLayout } from '../../components/layout/LayoutContext'
import { Avatar, Button, Card, SectionTitle } from '../../components/ui'
import { roleLine } from '../../lib/format'
import type { NetworkOutletContext } from './NetworkLayout'

// Mentors across your connections and suggestions — for finding/connecting
// with mentors on the network. Distinct from /mentorship, which is about
// booking sessions with mentors you've already connected with.
export function NetworkMentors() {
  const { users, currentUser, sendConnect, connectionState } = useApp()
  const { openChatWith } = useLayout()
  const { openQuickView } = useOutletContext<NetworkOutletContext>()

  const mentors = users.filter((u) => u.isMentor && u.id !== currentUser.id && u.id !== 'rooman')

  return (
    <section>
      <SectionTitle>Mentors ({mentors.length})</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {mentors.map((u) => {
          const state = connectionState(u.id)
          return (
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
              {state === 'connected' ? (
                <Button variant="subtle" className="mt-3 w-full" onClick={() => openChatWith(u.id)}>
                  <MessageSquare size={15} /> Message
                </Button>
              ) : (
                <Button
                  variant={state === 'pending' ? 'subtle' : 'outline'}
                  className="mt-3 w-full"
                  disabled={state === 'pending'}
                  onClick={() => sendConnect(u.id)}
                >
                  {state === 'pending' ? 'Request sent' : 'Connect'}
                </Button>
              )}
            </Card>
          )
        })}
        {mentors.length === 0 && (
          <p className="text-sm text-[#878a8c]">No mentors on the network yet.</p>
        )}
      </div>
    </section>
  )
}
