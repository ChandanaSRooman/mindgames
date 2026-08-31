import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, MessagesSquare, Paperclip, Pencil, Send, UserRound, Users, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar } from '../ui'
import { api } from '../../lib/api'
import { toBase64 } from '../../lib/file'

const ATTACHMENT_TYPES: Record<string, boolean> = {
  'application/pdf': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
}
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const EDIT_WINDOW_MS = 5 * 60 * 1000

const QUICK_PROMPTS = [
  { label: 'Ask for resume', text: 'Could you share your resume when you get a chance?' },
  { label: "What's next?", text: "What's the best next step from here?" },
]

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
  const { threads, userById, sendMessage, editMessage, markThreadRead, messageUser, refreshThreads, notify } = useApp()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (editingId) {
      editMessage(active.id, editingId, draft)
      setEditingId(null)
    } else {
      sendMessage(active.id, draft)
    }
    setDraft('')
  }

  function startEdit(messageId: string, text: string) {
    setEditingId(messageId)
    setDraft(text)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft('')
  }

  async function attachFile(file: File) {
    if (!active) return
    if (!ATTACHMENT_TYPES[file.type]) {
      notify('Attachments must be a PDF or .docx file.', 'error')
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      notify('File is too large — please keep it under 5MB.', 'error')
      return
    }
    setAttaching(true)
    try {
      const dataBase64 = await toBase64(file)
      sendMessage(active.id, '', { name: file.name, dataBase64, mediaType: file.type })
    } catch {
      notify('Could not attach that file. Try again.', 'error')
    } finally {
      setAttaching(false)
    }
  }

  async function downloadAttachment(messageId: string, name: string) {
    try {
      const blob = await api.downloadAttachment(messageId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not download the file.', 'error')
    }
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
            <button
              onClick={() => {
                setActiveId(null)
                cancelEdit()
              }}
              className="rounded-full p-1 hover:bg-gray-100"
            >
              <ArrowLeft size={18} className="text-[#878a8c]" />
            </button>
          ) : null}
          <h3 className="flex-1 truncate font-bold text-[#1c1c1c]">
            {active ? activeUser?.name : 'Messages'}
          </h3>
          {active && activeUser && (
            <button
              onClick={() => {
                onClose()
                navigate(`/profile/${activeUser.id}`)
              }}
              title="View profile"
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[#ff4500] hover:bg-orange-50"
            >
              <UserRound size={14} /> View Profile
            </button>
          )}
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
              {active.messages.map((m) => {
                const canEdit = m.fromMe && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS
                return (
                  <div key={m.id} className={`flex items-end gap-1 ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                    {canEdit && (
                      <button
                        onClick={() => startEdit(m.id, m.text)}
                        title="Edit message (within 5 minutes of sending)"
                        className={`shrink-0 rounded-full p-1 transition-colors hover:bg-gray-200 ${
                          editingId === m.id ? 'bg-gray-200 text-[#1c1c1c]' : 'text-[#c3c6c9]'
                        }`}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.fromMe ? 'bg-[#ff4500] text-white' : 'bg-white text-[#1c1c1c] border border-[#edeff1]'
                      }`}
                    >
                      {m.attachment && (
                        <button
                          onClick={() => downloadAttachment(m.id, m.attachment!.name)}
                          className={`mb-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                            m.fromMe
                              ? 'border-white/30 bg-white/10 hover:bg-white/20'
                              : 'border-[#edeff1] bg-[#f6f7f8] hover:bg-gray-100'
                          }`}
                        >
                          <FileText size={16} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">{m.attachment.name}</span>
                          <Download size={14} className="shrink-0" />
                        </button>
                      )}
                      {m.text}
                      <span className={`mt-1 block text-[10px] ${m.fromMe ? 'text-orange-100' : 'text-[#878a8c]'}`}>
                        {m.time}
                        {m.editedAt && ' · edited'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick prompts */}
            {!editingId && (
              <div className="flex gap-1.5 overflow-x-auto border-t border-[#edeff1] px-3 pt-2.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setDraft(p.text)}
                    className="shrink-0 rounded-full bg-[#f6f7f8] px-3 py-1 text-xs font-medium text-[#878a8c] transition-colors hover:bg-gray-200 hover:text-[#1c1c1c]"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {editingId && (
              <div className="flex items-center justify-between border-t border-[#edeff1] bg-orange-50 px-3 py-1.5 text-xs font-medium text-[#ff4500]">
                <span className="flex items-center gap-1"><Pencil size={11} /> Editing message</span>
                <button onClick={cancelEdit} className="rounded-full p-0.5 hover:bg-orange-100">
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) attachFile(file)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={attaching || !!editingId}
                title="Share your resume"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#878a8c] transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                <Paperclip size={17} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={attaching ? 'Attaching file…' : editingId ? 'Edit your message…' : 'Write a message…'}
                className="flex-1 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-4 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
              <button
                onClick={send}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#ff6534]"
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
