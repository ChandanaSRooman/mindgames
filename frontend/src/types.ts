// Domain model for RooConnect — the Rooman Alumni Network.
// All app state is mock data held in React context (see store/AppStore.tsx).

export type PostType = 'Update' | 'Hiring' | 'Open to Work' | 'Mentorship' | 'StartupVarsity'

export const POST_TYPES: PostType[] = ['Update', 'Hiring', 'Open to Work', 'Mentorship', 'StartupVarsity']

export type Domain =
  | 'Cloud'
  | 'AI/ML'
  | 'Cybersecurity'
  | 'DevOps'
  | 'Data'
  | 'Web Dev'
  | 'Mobile'
  | 'UI/UX'

export const DOMAINS: Domain[] = [
  'Cloud',
  'AI/ML',
  'Cybersecurity',
  'DevOps',
  'Data',
  'Web Dev',
  'Mobile',
  'UI/UX',
]

export type EmploymentType = 'Employed' | 'Freelancer' | 'Entrepreneur' | 'Looking for opportunity'

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  'Employed',
  'Freelancer',
  'Entrepreneur',
  'Looking for opportunity',
]

export type Visibility = 'All Alumni' | 'My Network' | 'Specific Community'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  avatar: string // initials-based color seed; rendered by <Avatar>
  batchYear: number
  course: string
  company: string
  designation: string
  experienceYears: number
  domain: Domain
  employmentType: EmploymentType
  city: string
  bio: string
  linkedin?: string
  expertise: string[]
  willingToMentor: boolean
  interestedInStartup: boolean
  connectionsCount: number
  isMentor: boolean
  mentorRate?: number // ₹ / hr
  sessionsConducted?: number
}

export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: string // ISO
}

export interface Post {
  id: string
  authorId: string
  type: PostType
  content: string
  image?: string
  createdAt: string // ISO
  likes: number
  likedByMe: boolean
  saved: boolean
  comments: Comment[]
  visibility: Visibility
  communityId?: string
  // Tags
  domain?: Domain
  city?: string
  batch?: number
  // Hiring / role specific
  role?: string
  company?: string
  // Pinned Rooman announcement (set from the Admin panel)
  pinned?: boolean
}

export type CommunityCategory = 'Domain' | 'City' | 'Batch' | 'General'

export interface Community {
  id: string
  name: string
  description: string
  category: CommunityCategory
  tag: string // e.g. 'Cloud', 'Bangalore', '2018'
  memberCount: number
  joined: boolean
  color: string // tailwind gradient seed
}

export type SessionStatus = 'upcoming' | 'past'

export interface MentorshipSession {
  id: string
  mentorId: string
  menteeName: string
  topic: string
  date: string // human readable
  time: string
  status: SessionStatus
}

export type StartupStage = 'Idea' | 'MVP' | 'Early Revenue' | 'Scaling'

export interface Startup {
  id: string
  founderId: string
  name: string
  domain: Domain
  stage: StartupStage
  teamSize: number
  description: string
}

export type NotificationType =
  | 'connection'
  | 'like'
  | 'comment'
  | 'job'
  | 'mentorship'
  | 'community'
  | 'announcement'

export interface AppNotification {
  id: string
  type: NotificationType
  text: string
  createdAt: string // ISO
  read: boolean
  actorId?: string
}

export interface MessageThread {
  id: string
  withUserId: string
  lastMessage: string
  unread: number
  messages: { id: string; fromMe: boolean; text: string; time: string }[]
}

// Connection state between the current user and others.
export type ConnectionState = 'none' | 'pending' | 'connected'

// --- CSV import (Admin) -----------------------------------------------------
// Kept for the Admin invite uploader (see lib/csv.ts).
export interface ContactRow {
  name: string
  phone: string
  email: string
  valid: boolean
}

// --- Backend-aligned shapes (Admin + OAuth/invite flow) ---------------------
// These mirror backend/src/data.ts and are consumed by the teammate's
// invitation + auth code via lib/api.ts. Kept intact so that logic is untouched.
export type StatusTag = 'Ready to work' | 'Working' | 'Can mentor' | 'Need mentoring'

export const STATUS_TAGS: StatusTag[] = ['Ready to work', 'Working', 'Can mentor', 'Need mentoring']

export interface Alumni {
  id: string
  name: string
  phone: string
  email: string
  role: string
  batchYear: number
  statusTags: StatusTag[]
}

export interface Experience {
  role: string
  company: string
  period: string
  summary: string
}

export interface ResumeParseResult {
  name: string
  headline: string
  experience: Experience[]
  skills: string[]
}

// Light-theme styling for status tags (Admin directory pills).
export const STATUS_STYLES: Record<StatusTag, string> = {
  'Ready to work': 'bg-green-100 text-green-700',
  Working: 'bg-blue-100 text-blue-700',
  'Can mentor': 'bg-orange-100 text-[#ff4500]',
  'Need mentoring': 'bg-amber-100 text-amber-700',
}

// --- Shared styling maps ----------------------------------------------------

export const POST_TYPE_STYLES: Record<PostType, { label: string; classes: string }> = {
  Update: { label: 'Update', classes: 'bg-gray-100 text-gray-600' },
  Hiring: { label: 'Hiring', classes: 'bg-green-100 text-green-700' },
  'Open to Work': { label: 'Open to Work', classes: 'bg-blue-100 text-blue-700' },
  Mentorship: { label: 'Mentorship', classes: 'bg-orange-100 text-[#ff4500]' },
  StartupVarsity: { label: 'StartupVarsity', classes: 'bg-purple-100 text-purple-700' },
}
