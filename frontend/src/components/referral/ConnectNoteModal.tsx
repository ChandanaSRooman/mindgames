import { useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { User } from '../../types'

const MIN_WORDS = 25

// Connection request with a required, thoughtful note — used from Profile and
// the Companies alumni list. Extracted verbatim from Profile.tsx's inline
// modal (same 25-word gate, same copy) so existing "Send Note" behavior is
// unchanged; only the wiring for where sendConnect() gets called moved here.
export function ConnectNoteModal({
  user,
  onClose,
}: {
  user: Pick<User, 'id' | 'name'>
  onClose: () => void
}) {
  const { sendConnect } = useApp()
  const [note, setNote] = useState('')
  const wordCount = note.split(/\s+/).filter(Boolean).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1c1c1c]">Add a note to your invitation</h2>
          <button onClick={onClose} className="text-[#878a8c] hover:text-[#1c1c1c]">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-[#6b6e70]">
          Write a personal note (minimum {MIN_WORDS} words). Root Connect members are more likely to
          accept connection requests that include a thoughtful message.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Hi ${user.name.split(' ')[0]}, I'd love to connect with you because…`}
          maxLength={500}
          className="mb-2 w-full rounded-lg border border-[#edeff1] p-3 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:outline-none focus:ring-2 focus:ring-[#ff4500]/20"
          rows={5}
        />
        <div className="mb-4 flex justify-between">
          <span className={`text-xs font-medium ${wordCount < MIN_WORDS ? 'text-red-500' : 'text-green-600'}`}>
            {wordCount} / {MIN_WORDS} words
          </span>
          <span className="text-xs text-[#878a8c]">{note.length}/500</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-[#edeff1] px-4 py-2.5 font-medium text-[#1c1c1c] transition-colors hover:bg-[#f6f7f8]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (wordCount >= MIN_WORDS) {
                sendConnect(user.id, note.trim())
                onClose()
              }
            }}
            disabled={wordCount < MIN_WORDS}
            className="flex-1 rounded-full bg-[#ff4500] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#d13a00] disabled:cursor-not-allowed disabled:bg-[#c2c2c2]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
