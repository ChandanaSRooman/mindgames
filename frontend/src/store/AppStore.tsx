import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppEvent,
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
import { api, getToken, setToken } from '../lib/api'
import { googleSignIn } from '../lib/google'

// ---- Toasts ----------------------------------------------------------------
export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

let toastSeq = 0

export type AuthMethod = 'google' | 'linkedin' | 'email'

// A placeholder used before bootstrap / when signed out so components that read
// `currentUser` synchronously never hit undefined.
const GUEST: User = {
  id: 'guest',
  name: 'Guest',
  email: '',
  avatar: 'Guest',
  batchYear: new Date().getFullYear(),
  course: '',
  company: '',
  designation: '',
  experienceYears: 0,
  domain: 'Web Dev',
  employmentType: 'Employed',
  city: '',
  bio: '',
  expertise: [],
  willingToMentor: false,
  interestedInStartup: false,
  connectionsCount: 0,
  isMentor: false,
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
  questions?: string[]
  wantsResume?: boolean
}

interface AppContextValue {
  // auth / profile
  currentUser: User
  isAuthenticated: boolean
  loading: boolean
  /** True when real Google OAuth is configured; false = demo-account fallback. */
  googleReady: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (name: string, email: string, password: string) => Promise<User>
  social: (provider: 'google' | 'linkedin') => Promise<User>
  updateProfile: (patch: Partial<User>) => Promise<void>
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
  refreshNetwork: () => Promise<void>

  // posts
  posts: Post[]
  createPost: (input: NewPostInput) => void
  updatePost: (id: string, patch: Partial<Post>) => void
  toggleLike: (id: string) => void
  toggleSave: (id: string) => void
  addComment: (postId: string, text: string) => void
  applyToJob: (postId: string, answers?: string[], resume?: { name: string; dataBase64: string; mediaType: string }) => void

  // communities
  communities: Community[]
  toggleJoin: (id: string) => void
  createCommunity: (c: { name: string; description: string; category: Community['category']; tag: string }) => void

  // mentorship + startups
  sessions: MentorshipSession[]
  bookSession: (mentorId: string, topic: string, date: string, time: string) => void
  acceptSession: (id: string, meetingLink?: string) => void
  rateSession: (id: string, rating: number, review?: string) => void
  declineSession: (id: string) => void
  completeSession: (id: string) => void
  becomeMentor: (rate: number) => void
  startups: Startup[]
  submitStartup: (
    s: { name: string; domain: Startup['domain']; stage: Startup['stage']; teamSize: number; description: string; visibility: 'network' | 'admin' },
    shareToFeed?: boolean,
  ) => void

  // events
  events: AppEvent[]
  createEvent: (e: { title: string; description: string; location: string; meetingLink?: string; startsAt: string; isPaid?: boolean; price?: number }) => Promise<void>
  toggleRsvp: (id: string) => void
  cancelEvent: (id: string) => void

  // admin: announcements + mentor approvals
  pinnedPostIds: string[]
  announce: (text: string, pin?: boolean) => void
  unpinAnnouncement: (id: string) => void
  pendingMentorIds: string[]
  approveMentor: (id: string) => void
  declineMentor: (id: string) => void

  // notifications
  notifications: AppNotification[]
  unreadNotifications: number
  markNotificationsRead: () => void
  markNotificationRead: (id: string) => void

  // messages
  threads: MessageThread[]
  unreadMessages: number
  sendMessage: (threadId: string, text: string) => void
  markThreadRead: (threadId: string) => void
  messageUser: (userId: string) => Promise<string>
  refreshThreads: () => Promise<void>

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

  // ---- auth + server-backed data ------------------------------------------
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [bootstrapped, setBootstrapped] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [users, setUsers] = useState<User[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [connectionIds, setConnectionIds] = useState<string[]>([])
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([])
  const [pendingRequestIds, setPendingRequestIds] = useState<string[]>([])
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [startups, setStartups] = useState<Startup[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [pendingMentorIds, setPendingMentorIds] = useState<string[]>([])

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

  // ---- bootstrap: load users, feed & connections for the signed-in user ---
  const bootstrap = useCallback(async () => {
    try {
      const [me, allUsers, feed, graph, msgThreads, comms, sess, sups, notifs, evts] = await Promise.all([
        api.me(),
        api.getUsers(),
        api.getFeed(),
        api.getConnections(),
        api.getThreads(),
        api.getCommunities(),
        api.getSessions(),
        api.getStartups(),
        api.getNotifications(),
        api.getEvents().catch(() => [] as AppEvent[]),
      ])
      setUsers(allUsers.some((u) => u.id === me.id) ? allUsers : [me, ...allUsers])
      setCurrentUserId(me.id)
      setPosts(feed)
      setEvents(evts)
      setConnectionIds(graph.connectionIds)
      setSentRequestIds(graph.sentRequestIds)
      setPendingRequestIds(graph.pendingRequestIds)
      setThreads(msgThreads)
      setCommunities(comms)
      setSessions(sess)
      setStartups(sups)
      setNotifications(notifs)
      // Mentor approvals are an admin-only view.
      if (me.isAdmin) {
        api.getMentorApplications().then(setPendingMentorIds, () => {})
      }
    } catch {
      // Token missing/expired — drop it so the app falls back to signed-out.
      setToken(null)
      setTokenState(null)
      setCurrentUserId(null)
    } finally {
      setBootstrapped(true)
    }
  }, [])

  // Which social providers are real (backend reports GOOGLE_CLIENT_ID).
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  // Run once on mount: if we have a token, hydrate from the API.
  useEffect(() => {
    if (getToken()) bootstrap()
    else setBootstrapped(true)
    api.getAuthConfig().then((c) => setGoogleClientId(c.googleClientId), () => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAuthenticated = !!currentUserId
  const loading = !!token && !bootstrapped

  // ---- profile -------------------------------------------------------------
  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? GUEST,
    [users, currentUserId],
  )

  async function afterAuth(auth: { token: string; user: User }) {
    setToken(auth.token)
    setTokenState(auth.token)
    setBootstrapped(false)
    await bootstrap()
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    await afterAuth(res)
    return res.user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.signup(name, email, password)
    await afterAuth(res)
    return res.user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const social = useCallback(async (provider: 'google' | 'linkedin') => {
    // Real Google OAuth when the backend has a client id; simulated otherwise.
    if (provider === 'google' && googleClientId) {
      const accessToken = await googleSignIn(googleClientId)
      const res = await api.googleAuth(accessToken)
      await afterAuth(res)
      return res.user
    }
    const res = await api.social(provider)
    await afterAuth(res)
    return res.user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId])

  const signOut = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setCurrentUserId(null)
    setUsers([])
    setPosts([])
    setConnectionIds([])
    setSentRequestIds([])
    setPendingRequestIds([])
    setThreads([])
    setCommunities([])
    setSessions([])
    setStartups([])
    setNotifications([])
    setPendingMentorIds([])
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      const updated = await api.updateProfile(patch)
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)))
    },
    [],
  )

  const userById = useCallback((id: string) => users.find((u) => u.id === id), [users])

  // Re-pull the social state (connection graph, notifications, directory) so
  // requests sent by OTHER users show up without a full reload. Called when
  // My Network mounts and by a background poll.
  const refreshNetwork = useCallback(async () => {
    if (!getToken()) return
    try {
      const [graph, notifs, allUsers] = await Promise.all([
        api.getConnections(),
        api.getNotifications(),
        api.getUsers(),
      ])
      setConnectionIds(graph.connectionIds)
      setSentRequestIds(graph.sentRequestIds)
      setPendingRequestIds(graph.pendingRequestIds)
      setNotifications(notifs)
      setUsers((prev) => {
        const me = prev.find((u) => u.id === currentUserId)
        // Keep my own row from local state (it may hold an in-flight edit).
        return allUsers.map((u) => (u.id === currentUserId && me ? me : u))
      })
      await refreshThreads() // incoming chat messages + unread badge
    } catch {
      /* transient network failure — next poll retries */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  // Realtime: SSE pokes make chat + notifications update the moment they
  // change; the 30s poll below stays as a safety net for missed events.
  useEffect(() => {
    if (!isAuthenticated || !token) return
    const es = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`)
    const onNotification = () => api.getNotifications().then(setNotifications, () => {})
    const onMessage = () => void refreshThreads()
    es.addEventListener('notification', onNotification)
    es.addEventListener('message', onMessage)
    return () => es.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token])

  // Background poll (30s) while signed in — fallback behind the SSE stream.
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(refreshNetwork, 30_000)
    return () => clearInterval(interval)
  }, [isAuthenticated, refreshNetwork])

  // ---- connections ---------------------------------------------------------
  const connectionState = useCallback(
    (id: string): ConnectionState => {
      if (connectionIds.includes(id)) return 'connected'
      if (sentRequestIds.includes(id)) return 'pending'
      return 'none'
    },
    [connectionIds, sentRequestIds],
  )

  // People-you-may-know: everyone who isn't me, an admin/org account, or
  // already linked.
  const suggestionIds = useMemo(
    () =>
      users
        .filter(
          (u) =>
            u.id !== currentUserId &&
            !u.isAdmin &&
            u.id !== 'rooman' &&
            !connectionIds.includes(u.id) &&
            !sentRequestIds.includes(u.id) &&
            !pendingRequestIds.includes(u.id),
        )
        .map((u) => u.id),
    [users, currentUserId, connectionIds, sentRequestIds, pendingRequestIds],
  )

  // Bump the displayed connection count for me + the other user after an
  // accepted connection (mirrors the DB-side increment).
  const bumpCounts = useCallback(
    (otherId: string) => {
      setUsers((list) =>
        list.map((u) =>
          u.id === otherId || u.id === currentUserId
            ? { ...u, connectionsCount: u.connectionsCount + 1 }
            : u,
        ),
      )
    },
    [currentUserId],
  )

  const sendConnect = useCallback(
    (id: string) => {
      setSentRequestIds((s) => (s.includes(id) ? s : [...s, id]))
      const u = users.find((x) => x.id === id)
      api.connect(id).then(
        (r) => {
          if (r.state === 'connected') {
            // The other side had already requested me — instantly connected.
            setSentRequestIds((s) => s.filter((x) => x !== id))
            setPendingRequestIds((p) => p.filter((x) => x !== id))
            setConnectionIds((c) => (c.includes(id) ? c : [...c, id]))
            bumpCounts(id)
            notify(`You are now connected with ${u?.name ?? 'member'}.`)
          } else {
            notify(`Connection request sent to ${u?.name ?? 'member'}.`)
          }
        },
        () => {
          setSentRequestIds((s) => s.filter((x) => x !== id))
          notify('Could not send request. Try again.', 'error')
        },
      )
    },
    [notify, users, bumpCounts],
  )

  const acceptRequest = useCallback(
    (id: string) => {
      setPendingRequestIds((p) => p.filter((x) => x !== id))
      setConnectionIds((c) => (c.includes(id) ? c : [...c, id]))
      const u = users.find((x) => x.id === id)
      api.acceptConnection(id).then(
        () => {
          bumpCounts(id)
          notify(`You are now connected with ${u?.name ?? 'member'}.`)
        },
        () => notify('Could not accept the request.', 'error'),
      )
    },
    [notify, users, bumpCounts],
  )

  const ignoreRequest = useCallback((id: string) => {
    setPendingRequestIds((p) => p.filter((x) => x !== id))
    api.ignoreConnection(id).catch(() => {})
  }, [])

  // ---- posts ---------------------------------------------------------------
  const createPost = useCallback(
    (input: NewPostInput) => {
      api.createPost({
        type: input.type,
        content: input.content.trim(),
        image: input.image,
        visibility: input.visibility,
        communityId: input.communityId,
        domain: input.domain,
        city: input.city,
        batch: input.batch,
        role: input.role,
        company: input.company,
        questions: input.questions,
        wantsResume: input.wantsResume,
      }).then(
        (created) => {
          setPosts((p) => [created, ...p])
          notify('Your post is live.')
        },
        () => notify('Could not publish your post.', 'error'),
      )
    },
    [notify],
  )

  const toggleLike = useCallback(
    (id: string) => {
      const post = posts.find((p) => p.id === id)
      if (!post) return
      const liking = !post.likedByMe
      // optimistic
      setPosts((list) =>
        list.map((p) =>
          p.id === id ? { ...p, likedByMe: liking, likes: p.likes + (liking ? 1 : -1) } : p,
        ),
      )
      const call = liking ? api.likePost(id) : api.unlikePost(id)
      call.then(
        (r) =>
          setPosts((list) =>
            list.map((p) => (p.id === id ? { ...p, likedByMe: r.likedByMe, likes: r.likes } : p)),
          ),
        () => {
          // revert to the server truth we knew before
          setPosts((list) =>
            list.map((p) =>
              p.id === id ? { ...p, likedByMe: post.likedByMe, likes: post.likes } : p,
            ),
          )
          notify('Could not update like.', 'error')
        },
      )
    },
    [posts, notify],
  )

  const toggleSave = useCallback(
    (id: string) => {
      const post = posts.find((p) => p.id === id)
      if (!post) return
      const saving = !post.saved
      setPosts((list) => list.map((p) => (p.id === id ? { ...p, saved: saving } : p)))
      const call = saving ? api.savePost(id) : api.unsavePost(id)
      call.then(
        () => notify(saving ? 'Saved to your bookmarks.' : 'Removed from saved.', 'info'),
        () => {
          setPosts((list) => list.map((p) => (p.id === id ? { ...p, saved: post.saved } : p)))
          notify('Could not update saved.', 'error')
        },
      )
    },
    [posts, notify],
  )

  const addComment = useCallback(
    (postId: string, text: string) => {
      if (!text.trim()) return
      api.addComment(postId, text.trim()).then(
        (comment) =>
          setPosts((list) =>
            list.map((p) =>
              p.id === postId ? { ...p, comments: [...p.comments, comment] } : p,
            ),
          ),
        () => notify('Could not post your comment.', 'error'),
      )
    },
    [notify],
  )

  const updatePost = useCallback(
    (id: string, patch: Partial<Post>) => {
      api.updatePost(id, patch).then(
        (updated) => {
          setPosts((list) => list.map((p) => (p.id === id ? updated : p)))
          notify('Job post updated.')
        },
        (err) => notify(err instanceof Error ? err.message : 'Could not update the post.', 'error'),
      )
    },
    [notify],
  )

  const applyToJob = useCallback(
    (postId: string, answers?: string[], resume?: { name: string; dataBase64: string; mediaType: string }) => {
      const post = posts.find((p) => p.id === postId)
      if (!post || post.appliedByMe) return
      // optimistic
      setPosts((list) =>
        list.map((p) =>
          p.id === postId
            ? { ...p, appliedByMe: true, applicantsCount: (p.applicantsCount ?? 0) + 1 }
            : p,
        ),
      )
      api.applyToJob(postId, answers, resume).then(
        (r) => {
          setPosts((list) =>
            list.map((p) =>
              p.id === postId ? { ...p, appliedByMe: true, applicantsCount: r.applicantsCount } : p,
            ),
          )
          const author = users.find((u) => u.id === post.authorId)
          notify(`Application sent to ${author?.name ?? 'the poster'} for "${post.role ?? 'the role'}".`)
        },
        (err) => {
          setPosts((list) =>
            list.map((p) =>
              p.id === postId
                ? { ...p, appliedByMe: post.appliedByMe, applicantsCount: post.applicantsCount }
                : p,
            ),
          )
          notify(err instanceof Error ? err.message : 'Could not send your application.', 'error')
        },
      )
    },
    [posts, users, notify],
  )

  // ---- communities (RDS-backed) --------------------------------------------
  const toggleJoin = useCallback(
    (id: string) => {
      const c = communities.find((x) => x.id === id)
      if (!c) return
      const joining = !c.joined
      // optimistic flip
      setCommunities((list) =>
        list.map((x) =>
          x.id === id
            ? { ...x, joined: joining, memberCount: x.memberCount + (joining ? 1 : -1) }
            : x,
        ),
      )
      const call = joining ? api.joinCommunity(id) : api.leaveCommunity(id)
      call.then(
        (updated) => {
          setCommunities((list) => list.map((x) => (x.id === id ? updated : x)))
          notify(joining ? `Joined ${c.name}.` : `Left ${c.name}.`, 'info')
        },
        () => {
          setCommunities((list) => list.map((x) => (x.id === id ? c : x)))
          notify('Could not update membership.', 'error')
        },
      )
    },
    [communities, notify],
  )

  const createCommunity = useCallback(
    (c: { name: string; description: string; category: Community['category']; tag: string }) => {
      api.createCommunity(c).then(
        (created) => {
          setCommunities((list) => [created, ...list])
          notify(
            created.status === 'pending'
              ? `"${created.name}" submitted — it goes live once the Rooman team approves it.`
              : `Community "${created.name}" created.`,
          )
        },
        () => notify('Could not create the community.', 'error'),
      )
    },
    [notify],
  )

  // ---- mentorship + startups (RDS-backed) ----------------------------------
  const bookSession = useCallback(
    (mentorId: string, topic: string, date: string, time: string) => {
      api.bookSession(mentorId, topic, date, time).then(
        (session) => {
          setSessions((s) => [session, ...s])
          const m = users.find((u) => u.id === mentorId)
          notify(`Session requested with ${m?.name ?? 'mentor'} for ${date} at ${time}.`)
        },
        (err) =>
          notify(err instanceof Error ? err.message : 'Could not book the session.', 'error'),
      )
    },
    [notify, users],
  )

  // Mentor actions on a session request; each returns the updated session.
  const sessionAction = useCallback(
    (call: Promise<MentorshipSession>, successMsg: string) => {
      call.then(
        (updated) => {
          setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)))
          notify(successMsg)
        },
        (err) => notify(err instanceof Error ? err.message : 'Could not update the session.', 'error'),
      )
    },
    [notify],
  )

  const acceptSession = useCallback(
    (id: string, meetingLink?: string) =>
      sessionAction(api.acceptSession(id, meetingLink), 'Session confirmed. The mentee has been notified.'),
    [sessionAction],
  )
  const rateSession = useCallback(
    (id: string, rating: number, review?: string) =>
      sessionAction(api.rateSession(id, rating, review), 'Thanks — your rating helps other alumni. ⭐'),
    [sessionAction],
  )
  const declineSession = useCallback(
    (id: string) => sessionAction(api.declineSession(id), 'Session declined.'),
    [sessionAction],
  )
  const completeSession = useCallback(
    (id: string) => {
      sessionAction(api.completeSession(id), 'Session marked completed. 🎓')
      // reflect the mentor's new session count locally
      setUsers((list) =>
        list.map((u) =>
          u.id === currentUserId ? { ...u, sessionsConducted: (u.sessionsConducted ?? 0) + 1 } : u,
        ),
      )
    },
    [sessionAction, currentUserId],
  )

  const becomeMentor = useCallback(
    (rate: number) => {
      updateProfile({ isMentor: true, willingToMentor: true, mentorRate: rate, sessionsConducted: 0 })
        .then(() => notify('You are now listed as a mentor. 🎉'))
        .catch(() => notify('Could not update your mentor status.', 'error'))
    },
    [notify, updateProfile],
  )

  const createEvent = useCallback(
    async (e: { title: string; description: string; location: string; meetingLink?: string; startsAt: string; isPaid?: boolean; price?: number }) => {
      const created = await api.createEvent(e)
      setEvents((list) =>
        [...list, created].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
      )
      notify(
        created.status === 'pending'
          ? 'Event submitted — an admin will review it before it goes live.'
          : 'Your event is live — the network has been notified. 🎉',
        created.status === 'pending' ? 'info' : 'success',
      )
    },
    [notify],
  )

  const toggleRsvp = useCallback(
    (id: string) => {
      const ev = events.find((x) => x.id === id)
      if (!ev) return
      const call = ev.rsvpedByMe ? api.unrsvpEvent : api.rsvpEvent
      call(id).then(
        (updated) => setEvents((list) => list.map((x) => (x.id === id ? updated : x))),
        () => notify('Could not update your RSVP. Try again.', 'error'),
      )
    },
    [events, notify],
  )

  const cancelEvent = useCallback(
    (id: string) => {
      api.cancelEvent(id).then(
        () => {
          setEvents((list) => list.filter((x) => x.id !== id))
          notify('Event cancelled — attendees have been notified.')
        },
        (err) => notify(err instanceof Error ? err.message : 'Could not cancel the event.', 'error'),
      )
    },
    [notify],
  )

  const submitStartup = useCallback(
    (
      s: { name: string; domain: Startup['domain']; stage: Startup['stage']; teamSize: number; description: string; visibility: 'network' | 'admin' },
      shareToFeed = false,
    ) => {
      api.submitStartup(s).then(
        (created) => {
          setStartups((list) => [created, ...list])
          notify('StartupVarsity application submitted.')
          // Optionally announce the idea to the whole network as a feed post.
          if (shareToFeed) {
            api
              .createPost({
                type: 'StartupVarsity',
                content: `🚀 ${s.name} — ${s.description}\n\nStage: ${s.stage} · Team of ${s.teamSize} · ${s.domain}. Just applied to StartupVarsity!`,
                domain: s.domain,
                visibility: 'All Alumni',
              })
              .then((post) => setPosts((p) => [post, ...p]))
              .catch(() => notify('Idea saved, but sharing to the feed failed.', 'error'))
          }
        },
        () => notify('Could not submit your application.', 'error'),
      )
    },
    [notify],
  )

  // ---- admin: announcements + mentor approvals (RDS-backed) ---------------
  const pinnedPostIds = posts.filter((p) => p.pinned).map((p) => p.id)

  const announce = useCallback(
    (text: string, pin = true) => {
      if (!text.trim()) return
      api.announce(text.trim(), pin).then(
        (post) => {
          setPosts((p) => [post, ...p])
          notify(pin ? 'Announcement pinned to the feed.' : 'News update published.')
        },
        () => notify('Could not publish.', 'error'),
      )
    },
    [notify],
  )

  const unpinAnnouncement = useCallback(
    (id: string) => {
      api.unpinPost(id).then(
        () => {
          setPosts((list) => list.map((p) => (p.id === id ? { ...p, pinned: undefined } : p)))
          notify('Announcement unpinned.', 'info')
        },
        () => notify('Could not unpin the announcement.', 'error'),
      )
    },
    [notify],
  )

  const approveMentor = useCallback(
    (id: string) => {
      const u = users.find((x) => x.id === id)
      api.approveMentor(id).then(
        () => {
          setUsers((list) => list.map((x) => (x.id === id ? { ...x, isMentor: true, willingToMentor: true, mentorRate: x.mentorRate ?? 1000, sessionsConducted: x.sessionsConducted ?? 0 } : x)))
          setPendingMentorIds((p) => p.filter((x) => x !== id))
          notify(`${u?.name ?? 'Alumnus'} approved as a mentor.`)
        },
        () => notify('Could not approve the application.', 'error'),
      )
    },
    [notify, users],
  )

  const declineMentor = useCallback(
    (id: string) => {
      const u = users.find((x) => x.id === id)
      api.declineMentor(id).then(
        () => {
          setPendingMentorIds((p) => p.filter((x) => x !== id))
          notify(`${u?.name ?? 'Application'} declined.`, 'info')
        },
        () => notify('Could not decline the application.', 'error'),
      )
    },
    [notify, users],
  )

  // ---- notifications (RDS-backed) ------------------------------------------
  const unreadNotifications = notifications.filter((n) => !n.read).length
  const markNotificationsRead = useCallback(() => {
    if (!notifications.some((n) => !n.read)) return
    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
    api.markAllNotificationsRead().catch(() => {})
  }, [notifications])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
    api.markNotificationRead(id).catch(() => {})
  }, [])

  // ---- messages / chats (RDS-backed) --------------------------------------
  const unreadMessages = threads.reduce((sum, t) => sum + t.unread, 0)

  // Skip applying poll results while a send is in flight so a just-sent
  // message can't briefly vanish (poll snapshot may predate the send).
  const sendsInFlight = useRef(0)

  const refreshThreads = useCallback(async () => {
    if (!getToken() || sendsInFlight.current > 0) return
    try {
      const fresh = await api.getThreads()
      if (sendsInFlight.current === 0) setThreads(fresh)
    } catch {
      /* transient — next poll retries */
    }
  }, [])

  const sendMessage = useCallback(
    (threadId: string, text: string) => {
      if (!text.trim()) return
      sendsInFlight.current++
      api.sendMessage(threadId, text.trim())
        .then(
          (msg) =>
            setThreads((list) =>
              list.map((t) =>
                t.id === threadId
                  ? { ...t, unread: 0, lastMessage: msg.text, messages: [...t.messages, msg] }
                  : t,
              ),
            ),
          () => notify('Message failed to send.', 'error'),
        )
        .finally(() => {
          sendsInFlight.current--
        })
    },
    [notify],
  )

  const markThreadRead = useCallback((threadId: string) => {
    setThreads((list) => list.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)))
    api.markThreadRead(threadId).catch(() => {})
  }, [])

  // Open (or create) a conversation with a user; returns the thread id.
  const messageUser = useCallback(async (userId: string) => {
    const thread = await api.startThread(userId)
    setThreads((list) => (list.some((t) => t.id === thread.id) ? list : [thread, ...list]))
    return thread.id
  }, [])

  const value: AppContextValue = {
    currentUser,
    isAuthenticated,
    loading,
    googleReady: !!googleClientId,
    login,
    signup,
    social,
    updateProfile,
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
    refreshNetwork,
    posts,
    createPost,
    updatePost,
    toggleLike,
    toggleSave,
    addComment,
    applyToJob,
    communities,
    toggleJoin,
    createCommunity,
    sessions,
    bookSession,
    acceptSession,
    rateSession,
    declineSession,
    completeSession,
    becomeMentor,
    startups,
    submitStartup,
    events,
    createEvent,
    toggleRsvp,
    cancelEvent,
    pinnedPostIds,
    announce,
    unpinAnnouncement,
    pendingMentorIds,
    approveMentor,
    declineMentor,
    notifications,
    unreadNotifications,
    markNotificationsRead,
    markNotificationRead,
    threads,
    unreadMessages,
    sendMessage,
    markThreadRead,
    messageUser,
    refreshThreads,
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
