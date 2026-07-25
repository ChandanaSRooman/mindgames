// Domain model for Root Connect — the Rooman Alumni Network.
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

export type ProfileTag = 'Mentor' | 'Hiring' | 'Open to Work'

export const PROFILE_TAGS: ProfileTag[] = ['Mentor', 'Hiring', 'Open to Work']

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  // Small data-URL profile photo; absent → initials avatar.
  photo?: string | null
  // Status tag shown on the profile header.
  profileTag?: ProfileTag | null
  // Set once the user clicks the verification link emailed at signup.
  emailVerified?: boolean
  // Weekly digest email preference (Settings toggle).
  emailDigest?: boolean
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
  isAdmin?: boolean
}

// True until the member finishes the onboarding wizard. The wizard can't be
// completed without a course, so an empty course means setup never finished.
export function needsOnboarding(user: Pick<User, 'course' | 'isAdmin'>): boolean {
  return !user.isAdmin && !user.course
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
  // Set when this post is an update/recap tied to an event (host or admin only).
  eventId?: string
  // Tags
  domain?: Domain
  city?: string
  batch?: number
  // Hiring / role specific
  role?: string
  company?: string
  // What the poster wants every applicant to answer (Hiring posts).
  questions?: string[]
  // Whether applicants must attach a resume (Hiring posts).
  wantsResume?: boolean
  // Hiring posts: false = closed, not accepting applications.
  active?: boolean
  appliedByMe?: boolean
  applicantsCount?: number
  // Pinned Rooman announcement (set from the Admin panel)
  pinned?: boolean
}

// A member who applied to a Hiring post (poster-only view).
export interface JobApplicant {
  id: string
  name: string
  photo?: string | null
  designation: string
  company: string
  city: string
  // Question+answer pairs snapshotted at apply time.
  answers: { q: string; a: string }[]
  // Filename of the attached resume (null when none was attached).
  resumeName: string | null
  appliedAt: string // ISO
}

// An alumni meetup, webinar or reunion with RSVPs.
export interface AppEvent {
  id: string
  creatorId: string
  title: string
  description: string
  location: string
  meetingLink?: string
  startsAt: string // ISO
  // pending = awaiting admin acceptance (visible only to its host).
  status?: 'pending' | 'approved' | 'rejected'
  // Paid (ticketed) event + price in whole rupees. Payment is collected offline.
  isPaid?: boolean
  price?: number
  // Max confirmed RSVPs; undefined = unlimited. Extra RSVPs waitlist.
  capacity?: number
  // Speakers/agenda contributors, shown in the quick-view drawer.
  speakers: { name: string; bio: string }[]
  rsvpCount: number
  waitlistCount: number
  rsvpedByMe: boolean
  waitlistedByMe: boolean
  // Feedback (ratings), only collectible once the event has started.
  avgRating?: number
  feedbackCount: number
  feedbackByMe: boolean
  attendeeIds: string[]
}

// Admin review queue entry for events.
export interface PendingEvent extends AppEvent {
  creatorName: string
}

// An attendee, as shown in an event's quick-view drawer. `waitlisted` = past
// the capacity cap and not yet promoted (shown separately from confirmed).
export interface EventAttendee {
  id: string
  name: string
  designation: string
  photo?: string
  waitlisted: boolean
}

// One attendee's rating + comment (host/admin view of an event's feedback).
export interface EventFeedbackEntry {
  userId: string
  name: string
  photo?: string
  rating: number
  comment: string
  createdAt: string // ISO
}

// A computed profile achievement.
export interface Badge {
  id: string
  emoji: string
  label: string
  description: string
  earned: boolean
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
  /** pending = awaiting admin acceptance (visible only to its creator). */
  status?: 'pending' | 'approved' | 'rejected'
  createdBy?: string
}

// Admin review queue entry.
export interface PendingCommunity extends Community {
  creatorName: string
}

// requested → (mentor accepts) upcoming → (mentor completes) past; or declined.
export type SessionStatus = 'requested' | 'upcoming' | 'declined' | 'past'

export interface MentorshipSession {
  id: string
  mentorId: string
  menteeId: string
  menteeName: string
  topic: string
  date: string // human readable
  time: string
  status: SessionStatus
  // Shared by the mentor on acceptance (Meet/Zoom/…).
  meetingLink?: string
  // Mentee's post-session rating (1-5), once given.
  rating?: number
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
  // 'network' = visible to everyone; 'admin' = confidential (admins + founder only).
  visibility?: 'network' | 'admin'
}

// Admin review view: application + founder contact details.
export interface StartupApplication extends Startup {
  founderName: string
  founderEmail: string
  founderPhone?: string
  appliedAt: string // ISO
}

export type NotificationType =
  | 'connection'
  | 'like'
  | 'comment'
  | 'job'
  | 'mentorship'
  | 'community'
  | 'announcement'
  | 'event'

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
  email: string
  phone: string
  linkedin: string
  city: string
  headline: string
  bio: string
  batchYear: string
  course: string
  experienceYears: string
  domain: string
  employmentType: string
  experience: Experience[]
  skills: string[]
  // 'ai' = real Claude extraction; 'fallback' = server demo data (no API key).
  source: 'ai' | 'fallback'
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
