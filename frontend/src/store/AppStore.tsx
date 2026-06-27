import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppNotification,
  Community,
  ConnectionState,
  MentorshipSession,
  MessageThread,
  Post,
  PostType,
  Startup,
  User,
  Visibility,
} from '../types'
import {
  CURRENT_USER_ID,
  communities as seedCommunities,
  connectedIds as seedConnected,
  messageThreads as seedThreads,
  mentorshipSessions as seedSessions,
  notifications as seedNotifications,
  pendingMentorApplicationIds as seedMentorApplications,
  pendingRequestIds as seedPending,
  posts as seedPosts,
  startups as seedStartups,
  suggestionIds as seedSuggestions,
  users as seedUsers,
} from '../data/mockData'

// ---- Toasts ----------------------------------------------------------------
export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

let toastSeq = 0
let idSeq = 1000
const nextId = () => `gen-${idSeq++}`

// ---- Session persistence (localStorage — no backend needed) ----------------
// Ported from the teammate's account-persistence work and adapted to the
// richer User model. The signed-in profile + auth flag survive a refresh.
export type AuthMethod = 'google' | 'linkedin' | 'email'

const SESSION_KEY = 'rooman.session'

interface PersistedSession {
  user: User
  authenticated: boolean
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as PersistedSession) : null
  } catch {
    return null
  }
}

function saveSession(session: PersistedSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
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

export interface NewPostInput {
  type: PostType
  content: string
  image?: string
  domain?: Post['domain']
  city?: string
  batch?: number
  visibility: Visibility
  communityId?: string
  role?: string
  company?: string
}

interface AppContextValue {
  // auth / profile
  currentUser: User
  isAuthenticated: boolean
  setAuthenticated: (v: boolean) => void
  updateProfile: (patch: Partial<User>) => void
  signIn: (method: AuthMethod, email?: string, name?: string) => void
  signOut: () => void

  // people
  users: User[]
  userById: (id: string) => User | undefined
  connectionState: (id: string) => ConnectionState
  connectionIds: string[]
  suggestionIds: string[]
  pendingRequestIds: string[]
  sendConnect: (id: string) => void
  acceptRequest: (id: string) => void
  ignoreRequest: (id: string) => void

  // posts
  posts: Post[]
  createPost: (input: NewPostInput) => void
  toggleLike: (id: string) => void
  toggleSave: (id: string) => void
  addComment: (postId: string, text: string) => void

  // communities
  communities: Community[]
  toggleJoin: (id: string) => void
  createCommunity: (c: { name: string; description: string; category: Community['category']; tag: string }) => void

  // mentorship + startups
  sessions: MentorshipSession[]
  bookSession: (mentorId: string, topic: string) => void
  becomeMentor: (rate: number) => void
  startups: Startup[]
  submitStartup: (s: { name: string; domain: Startup['domain']; stage: Startup['stage']; teamSize: number; description: string }) => void

  // admin: announcements + mentor approvals
  pinnedPostIds: string[]
  announce: (text: string) => void
  pendingMentorIds: string[]
  approveMentor: (id: string) => void
  declineMentor: (id: string) => void

  // notifications
  notifications: AppNotification[]
  unreadNotifications: number
  markNotificationsRead: () => void

  // messages
  threads: MessageThread[]
  unreadMessages: number
  sendMessage: (threadId: string, text: string) => void

  // search
  query: string
  setQuery: (q: string) => void

  // toasts
  toasts: Toast[]
  notify: (message: string, kind?: ToastKind) => void
  dismissToast: (id: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  // Rehydrate the signed-in profile + auth flag from localStorage if present.
  const persisted = loadSession()
  const [isAuthenticated, setAuthenticated] = useState(persisted?.authenticated ?? false)
  const [users, setUsers] = useState<User[]>(() =>
    persisted?.user ? seedUsers.map((u) => (u.id === CURRENT_USER_ID ? persisted.user : u)) : seedUsers,
  )

  const [posts, setPosts] = useState<Post[]>(seedPosts)
  const [communities, setCommunities] = useState<Community[]>(seedCommunities)
  const [sessions, setSessions] = useState<MentorshipSession[]>(seedSessions)
  const [startups, setStartups] = useState<Startup[]>(seedStartups)
  const [notifications, setNotifications] = useState<AppNotification[]>(seedNotifications)
  const [threads, setThreads] = useState<MessageThread[]>(seedThreads)

  const [connectionIds, setConnectionIds] = useState<string[]>(seedConnected)
  const [suggestionIds, setSuggestionIds] = useState<string[]>(seedSuggestions)
  const [pendingRequestIds, setPendingRequestIds] = useState<string[]>(seedPending)
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([])
  const [pendingMentorIds, setPendingMentorIds] = useState<string[]>(seedMentorApplications)

  const [query, setQuery] = useState('')

  // ---- toasts --------------------------------------------------------------
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = ++toastSeq
      setToasts((t) => [...t, { id, kind, message }])
      setTimeout(() => dismissToast(id), 3500)
    },
    [dismissToast],
  )

  // ---- profile -------------------------------------------------------------
  const currentUser = useMemo(() => users.find((u) => u.id === CURRENT_USER_ID)!, [users])

  // Persist the signed-in profile + auth flag whenever they change.
  useEffect(() => {
    saveSession({ user: currentUser, authenticated: isAuthenticated })
  }, [currentUser, isAuthenticated])

  const updateProfile = useCallback((patch: Partial<User>) => {
    setUsers((list) => list.map((u) => (u.id === CURRENT_USER_ID ? { ...u, ...patch } : u)))
  }, [])

  // Sign in (from the OAuth / email invite page). Seeds the profile name/email.
  // A provided name (e.g. the email-signup Full Name field) wins; else derive from email.
  const signIn = useCallback((method: AuthMethod, email = '', name = '') => {
    setUsers((list) =>
      list.map((u) =>
        u.id === CURRENT_USER_ID
          ? {
              ...u,
              name: name.trim() || (u.name && u.name !== 'You' ? u.name : nameFromEmail(email, method)),
              email: email || u.email,
            }
          : u,
      ),
    )
    setAuthenticated(true)
  }, [])

  const signOut = useCallback(() => {
    setUsers((list) => list.map((u) => (u.id === CURRENT_USER_ID ? seedUsers.find((s) => s.id === CURRENT_USER_ID)! : u)))
    setAuthenticated(false)
    saveSession(null)
  }, [])

  const userById = useCallback((id: string) => users.find((u) => u.id === id), [users])

  // ---- connections ---------------------------------------------------------
  const connectionState = useCallback(
    (id: string): ConnectionState => {
      if (connectionIds.includes(id)) return 'connected'
      if (sentRequestIds.includes(id)) return 'pending'
      return 'none'
    },
    [connectionIds, sentRequestIds],
  )

  const sendConnect = useCallback(
    (id: string) => {
      setSentRequestIds((s) => (s.includes(id) ? s : [...s, id]))
      setSuggestionIds((s) => s.filter((x) => x !== id))
      const u = users.find((x) => x.id === id)
      notify(`Connection request sent to ${u?.name ?? 'member'}.`)
    },
    [notify, users],
  )

  const acceptRequest = useCallback(
    (id: string) => {
      setPendingRequestIds((p) => p.filter((x) => x !== id))
      setConnectionIds((c) => (c.includes(id) ? c : [...c, id]))
      const u = users.find((x) => x.id === id)
      notify(`You are now connected with ${u?.name ?? 'member'}.`)
    },
    [notify, users],
  )

  const ignoreRequest = useCallback((id: string) => {
    setPendingRequestIds((p) => p.filter((x) => x !== id))
  }, [])

  // ---- posts ---------------------------------------------------------------
  const createPost = useCallback(
    (input: NewPostInput) => {
      const post: Post = {
        id: nextId(),
        authorId: CURRENT_USER_ID,
        type: input.type,
        content: input.content.trim(),
        image: input.image,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        saved: false,
        comments: [],
        visibility: input.visibility,
        communityId: input.communityId,
        domain: input.domain,
        city: input.city,
        batch: input.batch,
        role: input.role,
        company: input.company,
      }
      setPosts((p) => [post, ...p])
      notify('Your post is live.')
    },
    [notify],
  )

  const toggleLike = useCallback((id: string) => {
    setPosts((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) }
          : p,
      ),
    )
  }, [])

  const toggleSave = useCallback(
    (id: string) => {
      setPosts((list) => list.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)))
      const p = posts.find((x) => x.id === id)
      notify(p?.saved ? 'Removed from saved.' : 'Saved to your bookmarks.', 'info')
    },
    [notify, posts],
  )

  const addComment = useCallback((postId: string, text: string) => {
    if (!text.trim()) return
    setPosts((list) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                { id: nextId(), authorId: CURRENT_USER_ID, text: text.trim(), createdAt: new Date().toISOString() },
              ],
            }
          : p,
      ),
    )
  }, [])

  // ---- communities ---------------------------------------------------------
  const toggleJoin = useCallback(
    (id: string) => {
      setCommunities((list) =>
        list.map((c) =>
          c.id === id
            ? { ...c, joined: !c.joined, memberCount: c.memberCount + (c.joined ? -1 : 1) }
            : c,
        ),
      )
      const c = communities.find((x) => x.id === id)
      notify(c?.joined ? `Left ${c.name}.` : `Joined ${c?.name}.`, 'info')
    },
    [communities, notify],
  )

  const createCommunity = useCallback(
    (c: { name: string; description: string; category: Community['category']; tag: string }) => {
      const community: Community = {
        id: nextId(),
        name: c.name,
        description: c.description,
        category: c.category,
        tag: c.tag,
        memberCount: 1,
        joined: true,
        color: 'from-orange-500 to-rose-600',
      }
      setCommunities((list) => [community, ...list])
      notify(`Community "${c.name}" created.`)
    },
    [notify],
  )

  // ---- mentorship + startups ----------------------------------------------
  const bookSession = useCallback(
    (mentorId: string, topic: string) => {
      const session: MentorshipSession = {
        id: nextId(),
        mentorId,
        menteeName: 'You',
        topic: topic || 'Mentorship session',
        date: 'To be scheduled',
        time: 'TBD',
        status: 'upcoming',
      }
      setSessions((s) => [session, ...s])
      const m = users.find((u) => u.id === mentorId)
      notify(`Session requested with ${m?.name ?? 'mentor'}.`)
    },
    [notify, users],
  )

  const becomeMentor = useCallback(
    (rate: number) => {
      updateProfile({ isMentor: true, willingToMentor: true, mentorRate: rate, sessionsConducted: 0 })
      notify('You are now listed as a mentor. 🎉')
    },
    [notify, updateProfile],
  )

  const submitStartup = useCallback(
    (s: { name: string; domain: Startup['domain']; stage: Startup['stage']; teamSize: number; description: string }) => {
      const startup: Startup = { id: nextId(), founderId: CURRENT_USER_ID, ...s }
      setStartups((list) => [startup, ...list])
      notify('StartupVarsity application submitted.')
    },
    [notify],
  )

  // ---- admin: announcements + mentor approvals -----------------------------
  const pinnedPostIds = posts.filter((p) => p.pinned).map((p) => p.id)

  const announce = useCallback(
    (text: string) => {
      if (!text.trim()) return
      const post: Post = {
        id: nextId(),
        authorId: 'rooman',
        type: 'Update',
        content: text.trim(),
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        saved: false,
        comments: [],
        visibility: 'All Alumni',
        pinned: true,
      }
      setPosts((p) => [post, ...p])
      setNotifications((list) => [
        { id: nextId(), type: 'announcement', text: `📢 Rooman: ${text.trim()}`, createdAt: new Date().toISOString(), read: false },
        ...list,
      ])
      notify('Announcement pinned to the feed.')
    },
    [notify],
  )

  const approveMentor = useCallback(
    (id: string) => {
      setUsers((list) => list.map((u) => (u.id === id ? { ...u, isMentor: true, willingToMentor: true, mentorRate: u.mentorRate ?? 1000, sessionsConducted: u.sessionsConducted ?? 0 } : u)))
      setPendingMentorIds((p) => p.filter((x) => x !== id))
      const u = users.find((x) => x.id === id)
      notify(`${u?.name ?? 'Alumnus'} approved as a mentor.`)
    },
    [notify, users],
  )

  const declineMentor = useCallback(
    (id: string) => {
      setPendingMentorIds((p) => p.filter((x) => x !== id))
      const u = users.find((x) => x.id === id)
      notify(`${u?.name ?? 'Application'} declined.`, 'info')
    },
    [notify, users],
  )

  // ---- notifications -------------------------------------------------------
  const unreadNotifications = notifications.filter((n) => !n.read).length
  const markNotificationsRead = useCallback(() => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
  }, [])

  // ---- messages ------------------------------------------------------------
  const unreadMessages = threads.reduce((sum, t) => sum + t.unread, 0)
  const sendMessage = useCallback((threadId: string, text: string) => {
    if (!text.trim()) return
    setThreads((list) =>
      list.map((t) =>
        t.id === threadId
          ? {
              ...t,
              unread: 0,
              lastMessage: text.trim(),
              messages: [...t.messages, { id: nextId(), fromMe: true, text: text.trim(), time: 'Now' }],
            }
          : t,
      ),
    )
  }, [])

  const value: AppContextValue = {
    currentUser,
    isAuthenticated,
    setAuthenticated,
    updateProfile,
    signIn,
    signOut,
    users,
    userById,
    connectionState,
    connectionIds,
    suggestionIds,
    pendingRequestIds,
    sendConnect,
    acceptRequest,
    ignoreRequest,
    posts,
    createPost,
    toggleLike,
    toggleSave,
    addComment,
    communities,
    toggleJoin,
    createCommunity,
    sessions,
    bookSession,
    becomeMentor,
    startups,
    submitStartup,
    pinnedPostIds,
    announce,
    pendingMentorIds,
    approveMentor,
    declineMentor,
    notifications,
    unreadNotifications,
    markNotificationsRead,
    threads,
    unreadMessages,
    sendMessage,
    query,
    setQuery,
    toasts,
    notify,
    dismissToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
