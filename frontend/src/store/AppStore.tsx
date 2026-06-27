import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { StatusTag } from '../types'

// ---- Toasts ----------------------------------------------------------------
export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

// ---- Profile (set during onboarding, read by the feed composer) ------------
interface Profile {
  displayName: string
  role: string
  tags: StatusTag[]
}

interface AppContextValue {
  toasts: Toast[]
  notify: (message: string, kind?: ToastKind) => void
  dismissToast: (id: number) => void
  profile: Profile
  setProfile: (p: Partial<Profile>) => void
}

const AppContext = createContext<AppContextValue | null>(null)

let toastSeq = 0

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [profile, setProfileState] = useState<Profile>({
    displayName: 'You',
    role: 'Alumni Member',
    tags: [],
  })

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = ++toastSeq
      setToasts((t) => [...t, { id, kind, message }])
      setTimeout(() => dismissToast(id), 4000)
    },
    [dismissToast],
  )

  const setProfile = useCallback((p: Partial<Profile>) => {
    setProfileState((prev) => ({ ...prev, ...p }))
  }, [])

  return (
    <AppContext.Provider value={{ toasts, notify, dismissToast, profile, setProfile }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
