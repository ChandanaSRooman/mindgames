// Convert snake_case DB rows into the camelCase JSON shapes the frontend
// consumes (see frontend/src/types.ts). Kept in one place so response shapes
// stay consistent across routes.

// Single source of truth for the user column list — auth.routes.ts and
// users.routes.ts both SELECT/RETURNING this so a new column can't go missing
// from one of them (see mapUser below, which has no fallback for a column
// that a route forgot to select).
export const USER_COLS = `id, name, email, phone, photo, profile_tag, email_verified_at, email_digest, avatar, batch_year, course, company, designation, college,
  experience_years, domain, employment_type, city, bio, linkedin, expertise,
  willing_to_mentor, interested_in_startup, connections_count, is_mentor,
  mentor_rate, sessions_conducted, is_admin`

export interface UserRow {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  profile_tag: string | null
  email_verified_at: Date | string | null
  email_digest: boolean
  avatar: string
  batch_year: number
  course: string
  company: string
  designation: string
  college: string
  experience_years: number
  domain: string
  employment_type: string
  city: string
  bio: string
  linkedin: string | null
  expertise: string[]
  willing_to_mentor: boolean
  interested_in_startup: boolean
  connections_count: number
  is_mentor: boolean
  mentor_rate: number | null
  sessions_conducted: number | null
  is_admin?: boolean
}

export function mapUser(r: UserRow) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? undefined,
    photo: r.photo ?? undefined,
    profileTag: r.profile_tag ?? undefined,
    emailVerified: !!r.email_verified_at,
    emailDigest: r.email_digest,
    avatar: r.avatar,
    batchYear: r.batch_year,
    course: r.course,
    company: r.company,
    designation: r.designation,
    college: r.college,
    experienceYears: r.experience_years,
    domain: r.domain,
    employmentType: r.employment_type,
    city: r.city,
    bio: r.bio,
    linkedin: r.linkedin ?? undefined,
    expertise: r.expertise ?? [],
    willingToMentor: r.willing_to_mentor,
    interestedInStartup: r.interested_in_startup,
    connectionsCount: r.connections_count,
    isMentor: r.is_mentor,
    mentorRate: r.mentor_rate ?? undefined,
    sessionsConducted: r.sessions_conducted ?? undefined,
    isAdmin: r.is_admin ?? undefined,
  }
}

export interface CommentRow {
  id: string
  author_id: string
  text: string
  created_at: Date | string
}

export function mapComment(r: CommentRow) {
  return {
    id: r.id,
    authorId: r.author_id,
    text: r.text,
    createdAt: new Date(r.created_at).toISOString(),
  }
}

export interface PostRow {
  id: string
  author_id: string
  type: string
  content: string
  image: string | null
  visibility: string
  community_id: string | null
  event_id: string | null
  domain: string | null
  city: string | null
  batch: number | null
  role: string | null
  company: string | null
  questions: string[] | null
  wants_resume: boolean
  active: boolean
  pinned: boolean
  likes: number
  created_at: Date | string
  liked_by_me?: boolean
  saved_by_me?: boolean
  applied_by_me?: boolean
  applicants_count?: number
  comments?: CommentRow[]
}

export function mapPost(r: PostRow) {
  return {
    id: r.id,
    authorId: r.author_id,
    type: r.type,
    content: r.content,
    image: r.image ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
    likes: r.likes,
    likedByMe: r.liked_by_me ?? false,
    saved: r.saved_by_me ?? false,
    appliedByMe: r.applied_by_me ?? false,
    applicantsCount: r.applicants_count ?? 0,
    comments: (r.comments ?? []).map(mapComment),
    visibility: r.visibility,
    communityId: r.community_id ?? undefined,
    eventId: r.event_id ?? undefined,
    domain: r.domain ?? undefined,
    city: r.city ?? undefined,
    batch: r.batch ?? undefined,
    role: r.role ?? undefined,
    company: r.company ?? undefined,
    questions: r.questions ?? [],
    wantsResume: r.wants_resume || undefined,
    active: r.active,
    pinned: r.pinned || undefined,
  }
}

export interface InviteeRow {
  id: string
  name: string
  phone: string
  email: string
  role: string
  batch_year: number
  status_tags: string[]
}

// Short human time for a chat message ("9:02 AM", "Mon", "24 Jun"), IST-based.
export function formatMsgTime(value: Date | string): string {
  const d = new Date(value)
  const now = new Date()
  const opts = { timeZone: 'Asia/Kolkata' } as const
  const sameDay = d.toLocaleDateString('en-IN', opts) === now.toLocaleDateString('en-IN', opts)
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (sameDay) return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, ...opts })
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short', ...opts })
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...opts })
}

// The Admin UI still expects the "Alumni" shape (id, name, phone, email, role,
// batchYear, statusTags).
export function mapInvitee(r: InviteeRow) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    role: r.role,
    batchYear: r.batch_year,
    statusTags: r.status_tags ?? [],
  }
}
