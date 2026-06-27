// Shapes mirror the backend JSON contract (backend/src/data.ts).

export type StatusTag = 'Ready to work' | 'Working' | 'Can mentor' | 'Need mentoring'

export const STATUS_TAGS: StatusTag[] = [
  'Ready to work',
  'Working',
  'Can mentor',
  'Need mentoring',
]

export interface Alumni {
  id: string
  name: string
  phone: string
  email: string
  role: string
  batchYear: number
  statusTags: StatusTag[]
}

export interface Post {
  id: string
  authorName: string
  authorRole: string
  authorTags: StatusTag[]
  content: string
  createdAt: string
  likes: number
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

// A row parsed from CSV / manual entry, before it becomes an Alumni.
export interface ContactRow {
  name: string
  phone: string
  email: string
  valid: boolean // false = missing required field or bad email
}

/** Per-status visual styling, shared by onboarding grid + feed filter. */
export const STATUS_STYLES: Record<StatusTag, { text: string; bg: string; ring: string; dot: string }> = {
  'Ready to work': { text: 'text-emerald-300', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/40', dot: 'bg-emerald-400' },
  Working: { text: 'text-sky-300', bg: 'bg-sky-500/15', ring: 'ring-sky-500/40', dot: 'bg-sky-400' },
  'Can mentor': { text: 'text-teal-300', bg: 'bg-teal-500/15', ring: 'ring-teal-500/40', dot: 'bg-teal-400' },
  'Need mentoring': { text: 'text-amber-300', bg: 'bg-amber-500/15', ring: 'ring-amber-500/40', dot: 'bg-amber-400' },
}
