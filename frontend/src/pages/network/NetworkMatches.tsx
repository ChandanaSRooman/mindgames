import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MapPin, X } from 'lucide-react'
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
  const [noteModal, setNoteModal] = useState<{ userId: string; name: string } | null>(null)
  const [note, setNote] = useState('')

  const handleSendWithNote = () => {
    const wordCount = note.split(/\s+/).filter(Boolean).length
    if (noteModal && wordCount >= 25) {
      sendConnect(noteModal.userId, note.trim())
      setNoteModal(null)
      setNote('')
    }
  }

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
              onClick={() => setNoteModal({ userId: u.id, name: u.name })}
            >
              {connectionState(u.id) === 'pending' ? 'Request sent' : 'Connect'}
            </Button>
          </Card>
        ))}
        {suggestions.length === 0 && (
          <p className="text-sm text-[#878a8c]">No suggestions match your filters.</p>
        )}
      </div>

      {/* Connection note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4" onClick={() => setNoteModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1c1c1c]">Add a note to your invitation</h2>
              <button
                onClick={() => setNoteModal(null)}
                className="text-[#878a8c] hover:text-[#1c1c1c]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-4 text-sm text-[#6b6e70]">
              Write a personal note (minimum 25 words). Root Connect members are more likely to accept connection requests that include a thoughtful message.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Hi ${noteModal.name}, I'd love to connect with you because…`}
              maxLength={500}
              className="mb-2 w-full rounded-lg border border-[#edeff1] p-3 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:outline-none focus:ring-2 focus:ring-[#ff4500]/20"
              rows={5}
            />
            <div className="mb-4 flex justify-between">
              <span className={`text-xs font-medium ${note.split(/\s+/).filter(Boolean).length < 25 ? 'text-red-500' : 'text-green-600'}`}>
                {note.split(/\s+/).filter(Boolean).length} / 25 words
              </span>
              <span className="text-xs text-[#878a8c]">{note.length}/500</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setNoteModal(null)}
                className="flex-1 rounded-full border border-[#edeff1] px-4 py-2.5 font-medium text-[#1c1c1c] transition-colors hover:bg-[#f6f7f8]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendWithNote}
                disabled={note.split(/\s+/).filter(Boolean).length < 25}
                className="flex-1 rounded-full bg-[#ff4500] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#d13a00] disabled:bg-[#c2c2c2] disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
