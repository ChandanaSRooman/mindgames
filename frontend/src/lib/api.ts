import type {
  Alumni,
  AppEvent,
  AppNotification,
  Badge,
  Comment,
  Community,
  ContactRow,
  JobApplicant,
  MentorshipSession,
  MessageThread,
  PendingCommunity,
  PendingEvent,
  Post,
  ResumeParseResult,
  Startup,
  StartupApplication,
  User,
} from '../types'

export type ChatMessage = MessageThread['messages'][number]

// ---- Token storage ---------------------------------------------------------
const TOKEN_KEY = 'rooman.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable (private mode) */
  }
}

// ---- Low-level fetch --------------------------------------------------------
async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  // 204 / empty bodies
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- Response shapes -------------------------------------------------------
export interface AuthResponse {
  token: string
  user: User
}

export interface ConnectionGraph {
  connectionIds: string[]
  sentRequestIds: string[]
  pendingRequestIds: string[]
}

export type Provider = 'google' | 'linkedin'

// ---- API surface -----------------------------------------------------------
export const api = {
  // auth
  signup: (name: string, email: string, password: string) =>
    http<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    http<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  social: (provider: Provider) =>
    http<AuthResponse>(`/api/auth/social/${provider}`, { method: 'POST' }),

  getAuthConfig: () => http<{ googleClientId: string | null }>('/api/auth/config'),

  googleAuth: (accessToken: string) =>
    http<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    }),

  me: () => http<{ user: User }>('/api/auth/me').then((r) => r.user),

  forgotPassword: (email: string) =>
    http<{ ok: boolean; message: string; devResetLink?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    http<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  verifyEmail: (token: string) =>
    http<{ ok: boolean }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resendVerification: () =>
    http<{ ok: boolean; alreadyVerified?: boolean; devVerifyLink?: string }>(
      '/api/auth/resend-verification',
      { method: 'POST' },
    ),

  changePassword: (currentPassword: string, newPassword: string) =>
    http<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: currentPassword || undefined, newPassword }),
    }),

  // users
  getUsers: () => http<User[]>('/api/users'),
  getUser: (id: string) => http<User>(`/api/users/${id}`),
  updateProfile: (patch: Partial<User>) =>
    http<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(patch) }),

  // posts / feed
  getFeed: () => http<Post[]>('/api/posts'),
  createPost: (input: Partial<Post>) =>
    http<Post>('/api/posts', { method: 'POST', body: JSON.stringify(input) }),
  updatePost: (id: string, patch: Partial<Post>) =>
    http<Post>(`/api/posts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  likePost: (id: string) =>
    http<{ likes: number; likedByMe: boolean }>(`/api/posts/${id}/like`, { method: 'POST' }),
  unlikePost: (id: string) =>
    http<{ likes: number; likedByMe: boolean }>(`/api/posts/${id}/like`, { method: 'DELETE' }),
  savePost: (id: string) =>
    http<{ saved: boolean }>(`/api/posts/${id}/save`, { method: 'POST' }),
  unsavePost: (id: string) =>
    http<{ saved: boolean }>(`/api/posts/${id}/save`, { method: 'DELETE' }),
  addComment: (postId: string, text: string) =>
    http<Comment>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // jobs (Hiring posts)
  applyToJob: (
    postId: string,
    answers?: string[],
    resume?: { name: string; dataBase64: string; mediaType: string },
  ) =>
    http<{ applied: boolean; applicantsCount: number }>(`/api/posts/${postId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ answers: answers ?? [], resume }),
    }),
  getApplicants: (postId: string) => http<JobApplicant[]>(`/api/posts/${postId}/applicants`),
  // Binary download — bypasses the JSON helper; caller turns the blob into a file.
  downloadApplicantResume: async (postId: string, applicantId: string): Promise<Blob> => {
    const token = getToken()
    const res = await fetch(`/api/posts/${postId}/applicants/${applicantId}/resume`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Download failed (${res.status})`)
    }
    return res.blob()
  },

  // connections
  getConnections: () => http<ConnectionGraph>('/api/connections'),
  connect: (id: string) =>
    http<{ ok: boolean; state: 'pending' | 'connected' }>(`/api/connections/${id}`, { method: 'POST' }),
  acceptConnection: (id: string) =>
    http<{ ok: boolean; state: string }>(`/api/connections/${id}/accept`, { method: 'POST' }),
  ignoreConnection: (id: string) =>
    http<{ ok: boolean; state: string }>(`/api/connections/${id}/ignore`, { method: 'POST' }),

  // messages / chats
  getThreads: () => http<MessageThread[]>('/api/messages/threads'),
  startThread: (userId: string) =>
    http<MessageThread>('/api/messages/thread', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  sendMessage: (conversationId: string, text: string) =>
    http<ChatMessage>(`/api/messages/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  markThreadRead: (conversationId: string) =>
    http<{ ok: boolean }>(`/api/messages/${conversationId}/read`, { method: 'POST' }),

  // communities
  getCommunities: () => http<Community[]>('/api/communities'),
  createCommunity: (c: { name: string; description: string; category: Community['category']; tag: string }) =>
    http<Community>('/api/communities', { method: 'POST', body: JSON.stringify(c) }),
  joinCommunity: (id: string) =>
    http<Community>(`/api/communities/${id}/join`, { method: 'POST' }),
  leaveCommunity: (id: string) =>
    http<Community>(`/api/communities/${id}/join`, { method: 'DELETE' }),
  getPendingCommunities: () => http<PendingCommunity[]>('/api/communities/pending'),
  approveCommunity: (id: string) =>
    http<{ ok: boolean }>(`/api/communities/${id}/approve`, { method: 'POST' }),
  rejectCommunity: (id: string) =>
    http<{ ok: boolean }>(`/api/communities/${id}/reject`, { method: 'POST' }),

  // mentorship
  getSessions: () => http<MentorshipSession[]>('/api/mentorship/sessions'),
  bookSession: (mentorId: string, topic: string, date: string, time: string) =>
    http<MentorshipSession>('/api/mentorship/sessions', {
      method: 'POST',
      body: JSON.stringify({ mentorId, topic, date, time }),
    }),
  acceptSession: (id: string, meetingLink?: string) =>
    http<MentorshipSession>(`/api/mentorship/sessions/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ meetingLink }),
    }),
  rateSession: (id: string, rating: number, review?: string) =>
    http<MentorshipSession>(`/api/mentorship/sessions/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review }),
    }),
  getMentorRatings: () =>
    http<Array<{ mentorId: string; avg: number; count: number }>>('/api/mentorship/ratings'),
  declineSession: (id: string) =>
    http<MentorshipSession>(`/api/mentorship/sessions/${id}/decline`, { method: 'POST' }),
  completeSession: (id: string) =>
    http<MentorshipSession>(`/api/mentorship/sessions/${id}/complete`, { method: 'POST' }),
  getMentorApplications: () => http<string[]>('/api/mentorship/applications'),
  approveMentor: (id: string) =>
    http<{ ok: boolean }>(`/api/mentorship/applications/${id}/approve`, { method: 'POST' }),
  declineMentor: (id: string) =>
    http<{ ok: boolean }>(`/api/mentorship/applications/${id}/decline`, { method: 'POST' }),

  // startups
  getStartups: () => http<Startup[]>('/api/startups'),
  getStartupApplications: () => http<StartupApplication[]>('/api/startups/applications'),
  submitStartup: (s: { name: string; domain: Startup['domain']; stage: Startup['stage']; teamSize: number; description: string; visibility: 'network' | 'admin' }) =>
    http<Startup>('/api/startups', { method: 'POST', body: JSON.stringify(s) }),

  // notifications
  getNotifications: () => http<AppNotification[]>('/api/notifications'),
  markNotificationRead: (id: string) =>
    http<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    http<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  // admin: network overview
  getAdminStats: () =>
    http<{
      members: number
      membersThisWeek: number
      invitees: number
      invited: number
      posts: number
      comments: number
      communities: number
      sessions: { upcoming: number; requested: number; completed: number }
      startups: number
      pendingMentorApps: number
      jobApplications: number
      messages: number
      integrations: { google: boolean; smtp: boolean; ai: boolean }
      recentMembers: Array<{ id: string; name: string; email: string; city: string; joinedAt: string }>
    }>('/api/admin/stats'),

  // admin: official content — pin=true announcement, pin=false quiet news update
  announce: (text: string, pin = true) =>
    http<Post>('/api/posts/announce', { method: 'POST', body: JSON.stringify({ text, pin }) }),
  unpinPost: (id: string) =>
    http<{ ok: boolean }>(`/api/posts/${id}/unpin`, { method: 'POST' }),

  // admin: invitee directory + invites (unchanged endpoints)
  getAlumni: () => http<Alumni[]>('/api/alumni'),
  addAlumni: (row: { name: string; phone: string; email: string }) =>
    http<Alumni>('/api/alumni', { method: 'POST', body: JSON.stringify(row) }),
  bulkAddAlumni: (rows: ContactRow[]) =>
    http<{ added: Alumni[]; skipped: Array<{ email?: string; reason: string }> }>(
      '/api/alumni/bulk',
      { method: 'POST', body: JSON.stringify({ rows }) },
    ),
  sendInvites: (invites: Array<{ id: string; email: boolean; whatsapp: boolean }>) =>
    http<{ emailCount: number; whatsappCount: number; total: number; message: string }>(
      '/api/invites/batch',
      { method: 'POST', body: JSON.stringify({ invites }) },
    ),

  // events
  getEvents: () => http<AppEvent[]>('/api/events'),
  createEvent: (e: { title: string; description: string; location: string; meetingLink?: string; startsAt: string; isPaid?: boolean; price?: number }) =>
    http<AppEvent>('/api/events', { method: 'POST', body: JSON.stringify(e) }),
  rsvpEvent: (id: string) => http<AppEvent>(`/api/events/${id}/rsvp`, { method: 'POST' }),
  unrsvpEvent: (id: string) => http<AppEvent>(`/api/events/${id}/rsvp`, { method: 'DELETE' }),
  cancelEvent: (id: string) => http<{ ok: boolean }>(`/api/events/${id}`, { method: 'DELETE' }),
  getPendingEvents: () => http<PendingEvent[]>('/api/events/pending'),
  approveEvent: (id: string) => http<{ ok: boolean }>(`/api/events/${id}/approve`, { method: 'POST' }),
  rejectEvent: (id: string) => http<{ ok: boolean }>(`/api/events/${id}/reject`, { method: 'POST' }),
  getEventAttendees: (id: string) =>
    http<Array<{ id: string; name: string; designation: string; photo?: string }>>(`/api/events/${id}/attendees`),

  // badges
  getBadges: (userId: string) => http<{ points: number; badges: Badge[] }>(`/api/users/${userId}/badges`),

  // reports / moderation
  report: (targetType: 'post' | 'user', targetId: string, reason: string) =>
    http<{ ok: boolean; already?: boolean }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, reason }),
    }),
  getReports: () =>
    http<Array<{ id: string; targetType: 'post' | 'user'; targetId: string; reason: string; status: string; reporterName: string; summary: string; createdAt: string }>>('/api/reports'),
  resolveReport: (id: string, removePost: boolean) =>
    http<{ ok: boolean }>(`/api/reports/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ removePost }),
    }),
  dismissReport: (id: string) =>
    http<{ ok: boolean }>(`/api/reports/${id}/dismiss`, { method: 'POST' }),

  // leaderboard
  getLeaderboard: () =>
    http<Array<{ id: string; name: string; photo?: string; designation: string; points: number }>>('/api/users/leaderboard'),

  // event calendar file
  downloadEventIcs: async (id: string): Promise<Blob> => {
    const token = getToken()
    const res = await fetch(`/api/events/${id}/ics`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    return res.blob()
  },

  // Ask Roo
  askRoo: (question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    http<{ answer: string }>('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ question, history }),
    }),

  // admin digest
  sendDigest: () => http<{ recipients: number; simulated: boolean }>('/api/admin/digest', { method: 'POST' }),

  // resume parsing
  parseResume: (dataBase64?: string, mediaType?: string) =>
    http<ResumeParseResult>('/api/resume/parse', {
      method: 'POST',
      body: JSON.stringify({ dataBase64, mediaType }),
    }),
}
