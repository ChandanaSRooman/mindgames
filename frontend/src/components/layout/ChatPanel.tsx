import { useState } from 'react'
import { ArrowLeft, Send, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar } from '../ui'

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { threads, userById, sendMessage } = useApp()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const active = threads.find((t) => t.id === activeId)
  const activeUser = active ? userById(active.withUserId) : undefined

  function send() {
    if (!active || !draft.trim()) return
    sendMessage(active.id, draft)
    setDraft('')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="animate-slidein flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[#edeff1] px-4 py-3">
          {active ? (
            <button onClick={() => setActiveId(null)} className="rounded-full p-1 hover:bg-gray-100">
              <ArrowLeft size={18} className="text-[#878a8c]" />
            </button>
          ) : null}
          <h3 className="flex-1 font-bold text-[#1c1c1c]">
            {active ? activeUser?.name : 'Messages'}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X size={18} className="text-[#878a8c]" />
          </button>
        </div>

        {/* List or conversation */}
        {!active ? (
          <div className="flex-1 overflow-y-auto">
            {threads.map((t) => {
              const u = userById(t.withUserId)
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className="flex w-full items-center gap-3 border-b border-[#edeff1] px-4 py-3 text-left hover:bg-gray-50"
                >
                  <Avatar name={u?.name ?? '?'} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1c1c1c]">{u?.name}</p>
                    <p className="truncate text-sm text-[#878a8c]">{t.lastMessage}</p>
                  </div>
                  {t.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff4500] px-1.5 text-xs font-bold text-white">
                      {t.unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f6f7f8] p-4">
              {active.messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.fromMe ? 'bg-[#ff4500] text-white' : 'bg-white text-[#1c1c1c] border border-[#edeff1]'
                    }`}
                  >
                    {m.text}
                    <span className={`mt-1 block text-[10px] ${m.fromMe ? 'text-orange-100' : 'text-[#878a8c]'}`}>
                      {m.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-[#edeff1] p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Write a message…"
                className="flex-1 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-4 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
              <button
                onClick={send}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#ff6534]"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
