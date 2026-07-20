import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessagesSquare, Send, Users, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar } from '../ui'

// How often the open panel pulls new messages. ponytail: websockets/SSE would
// replace this poll for true realtime.
const CHAT_POLL_MS = 4000

export function ChatPanel({
  initialUserId,
  onClose,
}: {
  initialUserId?: string
  onClose: () => void
}) {
  const { threads, userById, sendMessage, markThreadRead, messageUser, refreshThreads } = useApp()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Opened from a profile "Message" button — get/create that conversation.
  useEffect(() => {
    if (initialUserId) messageUser(initialUserId).then(setActiveId)
  }, [initialUserId, messageUser])

  // While the panel is open, poll for incoming messages so chats feel live.
  useEffect(() => {
    refreshThreads()
    const interval = setInterval(refreshThreads, CHAT_POLL_MS)
    return () => clearInterval(interval)
  }, [refreshThreads])

  const active = threads.find((t) => t.id === activeId)
  const activeUser = active ? userById(active.withUserId) : undefined

  // Mark the open conversation read — on open AND when new messages arrive.
  useEffect(() => {
    if (active && active.unread > 0) markThreadRead(active.id)
  }, [active, markThreadRead])

  // Keep the newest message in view.
  const messageCount = active?.messages.length ?? 0
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messageCount, activeId])

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
            {threads.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
                  <MessagesSquare size={28} />
                </div>
                <p className="font-semibold text-[#1c1c1c]">No messages yet</p>
                <p className="text-sm leading-relaxed text-[#878a8c]">
                  Chats with fellow alumni appear here. Open someone's profile and hit{' '}
                  <span className="font-semibold text-[#1c1c1c]">Message</span> to start a
                  conversation.
                </p>
                <button
                  onClick={() => {
                    onClose()
                    navigate('/network')
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#ff4500] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#ff6534]"
                >
                  <Users size={16} /> Find people to connect
                </button>
              </div>
            )}
            {threads.map((t) => {
              const u = userById(t.withUserId)
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className="flex w-full items-center gap-3 border-b border-[#edeff1] px-4 py-3 text-left hover:bg-gray-50"
                >
                  <Avatar name={u?.name ?? '?'} src={u?.photo} size={44} />
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
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f6f7f8] p-4">
              {active.messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <Avatar name={activeUser?.name ?? '?'} src={activeUser?.photo} size={56} />
                  <p className="mt-1 font-semibold text-[#1c1c1c]">{activeUser?.name}</p>
                  <p className="text-sm text-[#878a8c]">
                    This is the start of your conversation. Say hello! 👋
                  </p>
                </div>
              )}
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
