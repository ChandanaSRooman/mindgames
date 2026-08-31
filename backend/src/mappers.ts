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
  mentor_rate, sessions_conducted, work_email_domain, work_verified_at, is_admin`

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
  work_email_domain?: string | null
  work_verified_at?: Date | string | null
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
    // Employer verification (proves the user works at a company → can post jobs).
    employerVerified: !!r.work_verified_at,
    workEmailDomain: r.work_email_domain ?? undefined,
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
  meta: Record<string, unknown> | null
  reactions?: Record<string, number> | null
  my_reaction?: string | null
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
    // Format-specific fields for news posts; omitted when empty so non-news
    // posts stay lean in the JSON payload.
    meta: r.meta && Object.keys(r.meta).length ? r.meta : undefined,
    // Emoji reactions: { '👍': 3, '❤️': 1 } and the current user's own choice.
    reactions: r.reactions && Object.keys(r.reactions).length ? r.reactions : undefined,
    myReaction: r.my_reaction ?? undefined,
  }
}

export interface CompanyRow {
  id: string
  name: string
  domain: string | null
  industry: string
  alumni_count: number
  preview_alumni: { id: string; name: string; photo: string | null }[] | null
  saved_by_me?: boolean
}

// logo.clearbit.com is a free, keyless logo-by-domain service — no API key
// or upload flow needed. Frontend falls back to an initials badge on 404.
export function mapCompany(r: CompanyRow) {
  return {
    id: r.id,
    name: r.name,
    domain: r.domain ?? undefined,
    logoUrl: r.domain ? `https://logo.clearbit.com/${r.domain}` : undefined,
    industry: r.industry,
    alumniCount: r.alumni_count,
    previewAlumni: (r.preview_alumni ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      photo: a.photo ?? undefined,
    })),
    savedByMe: r.saved_by_me ?? false,
  }
}

export interface CompanyAlumnusRow {
  id: string
  name: string
  photo: string | null
  role: string
  location: string
  journey: string
  mutual_connections: number
}

export function mapCompanyAlumnus(r: CompanyAlumnusRow) {
  return {
    id: r.id,
    name: r.name,
    photo: r.photo ?? undefined,
    role: r.role,
    location: r.location,
    journey: r.journey,
    mutualConnections: r.mutual_connections,
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
