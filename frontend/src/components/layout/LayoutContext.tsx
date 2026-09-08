import { createContext, useContext } from 'react'
import type { PostType } from '../../types'

export interface LayoutContextValue {
  openComposer: (prefill?: { type?: PostType; communityId?: string }) => void
  toggleChat: () => void
  openChatWith: (userId: string) => void
  sidebarOpen: boolean
  toggleSidebar: () => void
}

export const LayoutContext = createContext<LayoutContextValue | null>(null)

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within AppLayout')
  return ctx
}
