import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { ChatPanel } from './ChatPanel'
import { PostCreateModal } from '../feed/PostCreateModal'
import { LayoutContext } from './LayoutContext'
import type { PostType } from '../../types'

export function AppLayout() {
  const [composer, setComposer] = useState<{ open: boolean; type?: PostType; communityId?: string }>({
    open: false,
  })
  const [chat, setChat] = useState<{ open: boolean; userId?: string }>({ open: false })

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
    </LayoutContext.Provider>
  )
}
