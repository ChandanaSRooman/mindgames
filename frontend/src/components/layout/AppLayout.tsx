import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MailWarning, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import { Navbar } from './Navbar'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { ChatPanel } from './ChatPanel'
import { AskRoo } from './AskRoo'
import { PostCreateModal } from '../feed/PostCreateModal'
import { LayoutContext } from './LayoutContext'
import type { PostType } from '../../types'

export function AppLayout() {
  const { currentUser, notify } = useApp()
  const [composer, setComposer] = useState<{ open: boolean; type?: PostType; communityId?: string }>({
    open: false,
  })
  const [chat, setChat] = useState<{ open: boolean; userId?: string }>({ open: false })
  const [verifyDismissed, setVerifyDismissed] = useState(false)
  const [resending, setResending] = useState(false)
  const showVerifyBanner =
    !verifyDismissed && !currentUser.isAdmin && currentUser.emailVerified === false

  async function resendVerification() {
    setResending(true)
    try {
      const r = await api.resendVerification()
      if (r.alreadyVerified) notify('Your email is already verified — reload the page.', 'info')
      else notify('Verification email sent — check your inbox.', 'success')
      if (r.devVerifyLink) console.log('Dev verification link:', r.devVerifyLink)
    } catch {
      notify('Could not send the email. Try again later.', 'error')
    } finally {
      setResending(false)
    }
  }

  const openComposer = useCallback(
    (prefill?: { type?: PostType; communityId?: string }) =>
      setComposer({ open: true, type: prefill?.type, communityId: prefill?.communityId }),
    [],
  )
  const toggleChat = useCallback(() => setChat((c) => ({ open: !c.open })), [])
  const openChatWith = useCallback((userId: string) => setChat({ open: true, userId }), [])

  return (
    <LayoutContext.Provider value={{ openComposer, toggleChat, openChatWith }}>
      <Navbar />
      <LeftSidebar />
      <RightSidebar />

      <main className="min-h-screen pt-14 lg:pl-[260px] xl:pr-[300px]">
        <div className="mx-auto w-full max-w-2xl px-4 py-5">
          {showVerifyBanner && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <MailWarning size={16} className="shrink-0" />
              <span className="flex-1">
                Please verify your email address — it keeps your account recoverable.
              </span>
              <button
                onClick={resendVerification}
                disabled={resending}
                className="font-bold text-amber-900 underline hover:no-underline disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend link'}
              </button>
              <button
                onClick={() => setVerifyDismissed(true)}
                className="rounded-full p-1 hover:bg-amber-100"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      {composer.open && (
        <PostCreateModal
          prefill={{ type: composer.type, communityId: composer.communityId }}
          onClose={() => setComposer({ open: false })}
        />
      )}
      {chat.open && (
        <ChatPanel initialUserId={chat.userId} onClose={() => setChat({ open: false })} />
      )}
      <AskRoo />
    </LayoutContext.Provider>
  )
}
