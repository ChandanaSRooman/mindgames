import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MapPin, MessageSquare, X } from 'lucide-react'
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
  const [noteModal, setNoteModal] = useState<{ userId: string; name: string } | null>(null)
  const [note, setNote] = useState('')

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
                  onClick={() => {
                    setNoteModal({ userId: u.id, name: u.name })
                    setNote('')
                  }}
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

      {/* Connection note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
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
              placeholder={`Hi ${noteModal.name.split(' ')[0]}, I'd love to connect with you because…`}
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
                onClick={() => {
                  const wordCount = note.split(/\s+/).filter(Boolean).length
                  if (noteModal && wordCount >= 25) {
                    sendConnect(noteModal.userId, note.trim())
                    setNoteModal(null)
                    setNote('')
                  }
                }}
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
