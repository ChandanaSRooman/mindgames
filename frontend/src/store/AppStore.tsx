import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Experience, StatusTag } from '../types'

// ---- Toasts ----------------------------------------------------------------
export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

// ---- Account (persisted to localStorage — no backend) ----------------------
export type AuthMethod = 'google' | 'linkedin' | 'email'

export interface Account {
  email: string
  method: AuthMethod
  displayName: string
  role: string
  headline?: string
  experience?: Experience[]
  skills?: string[]
  tags: StatusTag[]
  createdAt: string
}

const STORAGE_KEY = 'rooman.account'

function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

function saveAccount(account: Account | null) {
  try {
    if (account) localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — stay in-memory only */
  }
}

// Derive a friendly display name from an email local-part, else a sensible default.
function nameFromEmail(email: string, method: AuthMethod): string {
  if (email) {
    const local = email.split('@')[0]
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')
  }
  return method === 'google' ? 'Google User' : method === 'linkedin' ? 'LinkedIn User' : 'New Member'
}

interface AppContextValue {
  toasts: Toast[]
  notify: (message: string, kind?: ToastKind) => void
  dismissToast: (id: number) => void
  account: Account | null
  signIn: (method: AuthMethod, email?: string, name?: string) => void
  saveOnboarding: (
    data: Pick<Account, 'headline' | 'experience' | 'skills' | 'tags'> & { name?: string },
  ) => void
  signOut: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

let toastSeq = 0

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [account, setAccount] = useState<Account | null>(loadAccount)

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

  // Create (or refresh) the locally-stored account at signup.
  const signIn = useCallback((method: AuthMethod, email = '', name = '') => {
    setAccount((prev) => {
      // Reuse the existing account if the same email signs in again.
      if (prev && (prev.email === email || (!email && prev.method === method))) return prev
      const next: Account = {
        email,
        method,
        displayName: name.trim() || nameFromEmail(email, method),
        role: 'Alumni Member',
        tags: [],
        createdAt: new Date().toISOString(),
      }
      saveAccount(next)
      return next
    })
  }, [])

  // Persist the parsed/edited profile from onboarding onto the account.
  // The resume name becomes the display name (it's the most reliable source).
  const saveOnboarding = useCallback(
    (data: Pick<Account, 'headline' | 'experience' | 'skills' | 'tags'> & { name?: string }) => {
      setAccount((prev) => {
        const base: Account =
          prev ?? {
            email: '',
            method: 'email',
            displayName: 'New Member',
            role: 'Alumni Member',
            tags: [],
            createdAt: new Date().toISOString(),
          }
        const { name, ...profile } = data
        const next: Account = {
          ...base,
          ...profile,
          displayName: name?.trim() || base.displayName,
        }
        saveAccount(next)
        return next
      })
    },
    [],
  )

  const signOut = useCallback(() => {
    saveAccount(null)
    setAccount(null)
  }, [])

  return (
    <AppContext.Provider
      value={{ toasts, notify, dismissToast, account, signIn, saveOnboarding, signOut }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
