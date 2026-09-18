import { inviteLinkFor } from './email.js'
// Convert snake_case DB rows into the camelCase JSON shapes the frontend
// consumes (see frontend/src/types.ts). Kept in one place so response shapes
// stay consistent across routes.

// Single source of truth for the user column list — auth.routes.ts and
// users.routes.ts both SELECT/RETURNING this so a new column can't go missing
// from one of them (see mapUser below, which has no fallback for a column
// that a route forgot to select).
export const USER_COLS = `id, name, email, phone, photo, profile_tag, profile_tags, email_verified_at, email_digest, avatar, batch_year, course, company, designation, college,
  experience_years, domain, employment_type, city, bio, linkedin, expertise,
  willing_to_mentor, interested_in_startup, connections_count, is_mentor,
  mentor_rate, sessions_conducted, work_email_domain, work_verified_at, is_admin,
  experience, education, projects, certifications, achievements, other_links,
  languages_known, github, portfolio, industry, work_mode, open_to_relocate,
  interests, open_to_speak_at_events, rooman_center, mentor_topics,
  mentor_availability, mentorship_mode, open_to_referrals, referral_note,
  hiring_for, startup_intent, startup_looking_for, notice_period,
  preferred_locations, seeking_mentorship_in,
  mentor_assessment_score, mentor_assessment_provider, mentor_verified_at,
  show_email, show_phone,
  home_address, date_of_birth, salary_current, salary_expected,
  show_address, show_age, show_salary, banner_theme, banner_image, must_change_password, is_private`

export interface UserRow {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  profile_tag: string | null
  profile_tags: string[]
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
  // Rich profile detail. JSONB columns arrive already parsed from pg.
  experience: unknown
  education: unknown
  projects: unknown
  certifications: unknown
  achievements: unknown
  other_links: unknown
  languages_known: string[]
  github: string | null
  portfolio: string | null
  industry: string
  work_mode: string
  open_to_relocate: boolean
  interests: string[]
  open_to_speak_at_events: boolean
  rooman_center: string
  mentor_topics: string[]
  mentor_availability: string
  mentorship_mode: string
  open_to_referrals: boolean
  referral_note: string
  hiring_for: string[]
  startup_intent: string
  startup_looking_for: string[]
  notice_period: string
  preferred_locations: string[]
  seeking_mentorship_in: string[]
  mentor_assessment_score: number | null
  mentor_assessment_provider: string
  mentor_verified_at: Date | string | null
  show_email: boolean
  show_phone: boolean
  home_address: string
  date_of_birth: Date | string | null
  salary_current: number | null
  salary_expected: number | null
  show_address: boolean
  show_age: boolean
  show_salary: boolean
  banner_theme: string
  banner_image: string | null
  must_change_password?: boolean
  is_private?: boolean
}

/**
 * A DATE column comes back from pg as a JS Date at LOCAL midnight, so
 * toISOString() shifts it into the previous day anywhere east of UTC — in IST
 * a birthday of 1996-04-18 reads back as 1996-04-17. Formatting from the local
 * calendar parts keeps the day the member typed.
 */
function isoDate(d: Date | string | null): string | undefined {
  if (!d) return undefined
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** Whole years since a date of birth, or undefined if none is stored. */
function ageFrom(dob: Date | string | null): number | undefined {
  if (!dob) return undefined
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  // Not had this year's birthday yet.
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 0 && age < 150 ? age : undefined
}

/** JSONB defaults to '[]' but a hand-edited row could hold anything. */
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const opt = (v: string | null | undefined) => (v && v.length > 0 ? v : undefined)

/**
 * The member's own view of their profile — includes the private fields.
 * Use this ONLY where the response goes back to the owner (auth login/signup/
 * me, PATCH /users/me, work-email verification).
 *
 * Everything else must use `mapUser`, which strips them. The public mapper is
 * the default on purpose: a route that forgets to think about privacy leaks
 * nothing, and the mistake shows up as a missing field on your own profile
 * rather than as someone else's phone number on the directory.
 */
export function mapOwnUser(r: UserRow) {
  return {
    ...mapUser(r),
    // The owner always sees their own contact and personal details, whatever
    // the visibility flags say — those govern what OTHER members can see.
    email: r.email,
    phone: r.phone ?? undefined,
    homeAddress: r.home_address || undefined,
    // The raw date is owner-only; everyone else can at most see the age.
    dateOfBirth: isoDate(r.date_of_birth),
    age: ageFrom(r.date_of_birth),
    salaryCurrent: r.salary_current ?? undefined,
    salaryExpected: r.salary_expected ?? undefined,
    noticePeriod: opt(r.notice_period),
    preferredLocations: r.preferred_locations ?? [],
    seekingMentorshipIn: r.seeking_mentorship_in ?? [],
    // Owner-only: drives the "set your own password" prompt after an
    // invite-created account's first sign-in.
    mustChangePassword: r.must_change_password ?? false,
  }
}

/**
 * A private member as seen by someone they aren't connected to.
 *
 * An explicit ALLOWLIST, built field by field — not `mapUser` with fields
 * blanked afterwards. That earlier shape was a blocklist: it let 40 of
 * mapUser's fields through untouched, including `industry`, `roomanCenter`
 * and `workEmailDomain`, and any field added to mapUser in future would have
 * joined them silently. Listing what may be seen means a new field is
 * withheld by default, which is the direction a privacy filter has to fail
 * in.
 *
 * What stays visible is what makes someone findable and worth connecting to:
 * their name, photo, bio, batch, course, role, employer, city and training
 * domain, plus the mentor badge. Everything a connection is *for* — the rich
 * detail, availability, intent, contact — is withheld.
 *
 * Fields the client requires (see the non-optional members of `User` in
 * frontend/src/types.ts) are emitted empty rather than omitted, so the shape
 * stays valid; optional fields are simply absent.
 */
export function mapLimitedUser(r: UserRow) {
  return {
    // --- identity: enough to recognise them in a directory or search result
    id: r.id,
    name: r.name,
    photo: r.photo ?? undefined,
    avatar: r.avatar,
    bio: r.bio,
    batchYear: r.batch_year,
    course: r.course,
    designation: r.designation,
    company: r.company,
    city: r.city,
    domain: r.domain,
    employmentType: r.employment_type,
    connectionsCount: r.connections_count,
    // Mentoring status is public by design — a mentee choosing whether to
    // book is entitled to know an admin verified the credentials. The rate
    // and session count travel with it: they are what a mentee decides on,
    // and keeping isMentor without them rendered a private mentor as the
    // literal "₹/hr ·  sessions" wherever those fields are printed.
    isMentor: r.is_mentor,
    mentorVerified: !!r.mentor_verified_at,
    mentorRate: r.mentor_rate ?? undefined,
    sessionsConducted: r.sessions_conducted ?? undefined,
    // So the UI can explain why the rest is missing, and offer to connect.
    isPrivate: true,

    // --- withheld, but required by the client type
    email: '',
    expertise: [],
    experienceYears: 0,
    interestedInStartup: false,
    willingToMentor: false,
  }
}

export function mapUser(r: UserRow) {
  return {
    id: r.id,
    name: r.name,
    // Contact details are private by default and only published when the
    // member opts in. Withheld as '' / undefined rather than omitted, so the
    // User shape stays the same for every consumer. Nothing in the app reads
    // another member's email; the admin views use their own queries.
    email: r.show_email ? r.email : '',
    phone: r.show_phone ? (r.phone ?? undefined) : undefined,
    showEmail: r.show_email,
    showPhone: r.show_phone,
    // Each sensitive field is withheld unless its own lock is open. Date of
    // birth is never published even when age is — an exact DOB is an identity
    // document detail, an age is not.
    homeAddress: r.show_address ? r.home_address || undefined : undefined,
    age: r.show_age ? ageFrom(r.date_of_birth) : undefined,
    salaryCurrent: r.show_salary ? (r.salary_current ?? undefined) : undefined,
    salaryExpected: r.show_salary ? (r.salary_expected ?? undefined) : undefined,
    showAddress: r.show_address,
    showAge: r.show_age,
    showSalary: r.show_salary,
    photo: r.photo ?? undefined,
    // Whether this member restricts their posts and detail to connections.
    // Public information: the UI needs it to show the right call to action.
    isPrivate: !!r.is_private,
    profileTag: r.profile_tag ?? undefined,
    profileTags: r.profile_tags ?? [],
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

    // Rich profile detail (public).
    experience: arr(r.experience),
    education: arr(r.education),
    projects: arr(r.projects),
    certifications: arr(r.certifications),
    achievements: arr(r.achievements),
    otherLinks: arr(r.other_links),
    languagesKnown: r.languages_known ?? [],
    github: opt(r.github),
    portfolio: opt(r.portfolio),
    industry: opt(r.industry),
    workMode: opt(r.work_mode),
    openToRelocate: r.open_to_relocate,
    interests: r.interests ?? [],
    openToSpeakAtEvents: r.open_to_speak_at_events,
    roomanCenter: opt(r.rooman_center),
    mentorTopics: r.mentor_topics ?? [],
    mentorAvailability: opt(r.mentor_availability),
    mentorshipMode: opt(r.mentorship_mode),
    openToReferrals: r.open_to_referrals,
    referralNote: opt(r.referral_note),
    hiringFor: r.hiring_for ?? [],
    startupIntent: opt(r.startup_intent),
    startupLookingFor: r.startup_looking_for ?? [],
    // Public and cosmetic only — nobody's data depends on either value, so
    // they carry none of the privacy weight the fields above do. An image
    // overrides the theme entirely when present; the frontend decides which
    // to render, this just passes both through.
    bannerTheme: r.banner_theme,
    bannerImage: r.banner_image ?? undefined,
    // Public: a mentee deciding whether to book is entitled to know the
    // mentor's credentials were checked by an admin, and to see an assessment
    // score the same way a degree is visible.
    mentorVerified: !!r.mentor_verified_at,
    mentorAssessmentScore: r.mentor_assessment_score ?? undefined,
    mentorAssessmentProvider: opt(r.mentor_assessment_provider),
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

// ---------------------------------------------------------------------------
// Company signals: what a company "looks like", aggregated from the Rooman
// alumni already there plus the Hiring posts that name it.
//
// These are facts about the company side only — nothing here knows who is
// asking. The viewer-specific part (how well YOU match) is scored in the
// frontend's lib/companyMatch.ts, next to the existing person-to-person
// scorer in lib/matching.ts, so both live in one place and share a vocabulary.
// ---------------------------------------------------------------------------
export interface CompanySignalsRow {
  top_skills: { skill: string; holders: number }[] | null
  top_certifications: { name: string; holders: number }[] | null
  cities: { city: string; count: number }[] | null
  domains: { domain: string; count: number }[] | null
  hiring_roles: { role: string; count: number }[] | null
  /** Median years of experience among alumni there; null when nobody has said. */
  median_experience: number | null
  referral_open: number
  mentor_count: number
  roadmap_count: number
  /** Alumni there the viewer is already connected to — the network signal. */
  connected_alumni: number
  /** How many alumni these aggregates were computed from — drives confidence. */
  sample_size: number
}

export function mapCompanySignals(r: CompanySignalsRow) {
  return {
    topSkills: r.top_skills ?? [],
    topCertifications: r.top_certifications ?? [],
    cities: r.cities ?? [],
    domains: r.domains ?? [],
    hiringRoles: r.hiring_roles ?? [],
    medianExperience: r.median_experience ?? undefined,
    referralOpen: r.referral_open,
    mentorCount: r.mentor_count,
    roadmapCount: r.roadmap_count,
    connectedAlumni: r.connected_alumni,
    sampleSize: r.sample_size,
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

// ---------------------------------------------------------------------------
// Company roadmap: one alumnus's actual route into a company.
//
// Assembled from data the member already maintains — their experience
// timeline, course, batch and certifications — plus the advice they wrote if
// they answered a "share how you got in" ask. Nothing here is generated or
// guessed: every step is something a real person entered about themselves.
// ---------------------------------------------------------------------------

/**
 * First 4-digit year in a free-text period like "2019 — 2022" or
 * "Jun 2021 - Present". Returns null when there is no year to find, which
 * sorts those entries to the end rather than to 1970.
 */
export function startYearOf(period: unknown): number | null {
  if (typeof period !== 'string') return null
  const m = period.match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

interface RoadmapStep {
  role: string
  company: string
  period: string
  summary: string
  /** True for the stop at the company whose page this roadmap is shown on. */
  atThisCompany: boolean
}

export interface CompanyRoadmapRow {
  id: string
  name: string
  photo: string | null
  designation: string
  city: string
  course: string
  batch_year: number
  experience_years: number
  expertise: string[]
  experience: unknown
  certifications: unknown
  is_mentor: boolean
  mentor_topics: string[]
  open_to_referrals: boolean
  mutual_connections: number
  // Left-joined from company_roadmap_contributions — null when this alumnus
  // has not (yet) written anything on top of their timeline.
  contrib_role: string | null
  contrib_headline: string | null
  contrib_stages: unknown
  contrib_advice: string | null
  contrib_updated_at: Date | string | null
}

export function mapCompanyRoadmap(
  r: CompanyRoadmapRow,
  // One name or every spelling of it. The queries that select these rows
  // match on the company's alias list, so matching only the canonical name
  // here left a member whose company reads "Rooman", shown on the "Rooman
  // Technologies" page, with no step marked as here -- the current-company
  // dot never highlighted for exactly the case aliasing exists to fix.
  companyNames: string | string[],
) {
  const here = new Set(
    (Array.isArray(companyNames) ? companyNames : [companyNames]).map((n) =>
      n.trim().toLowerCase(),
    ),
  )
  const steps: RoadmapStep[] = arr(r.experience)
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .map((e) => ({
      role: String(e.role ?? ''),
      company: String(e.company ?? ''),
      period: String(e.period ?? ''),
      summary: String(e.summary ?? ''),
      atThisCompany: here.has(String(e.company ?? '').trim().toLowerCase()),
    }))
    // Oldest first: a roadmap is read from where they started, not from where
    // they are now. Entries with no parseable year keep their relative order
    // at the end rather than jumping to the front.
    .sort((a, b) => {
      const ay = startYearOf(a.period)
      const by = startYearOf(b.period)
      if (ay === null && by === null) return 0
      if (ay === null) return 1
      if (by === null) return -1
      return ay - by
    })

  return {
    userId: r.id,
    name: r.name,
    photo: r.photo ?? undefined,
    currentRole: r.designation,
    city: r.city,
    course: r.course,
    batchYear: r.batch_year,
    experienceYears: r.experience_years,
    skills: r.expertise ?? [],
    steps,
    certifications: arr(r.certifications),
    isMentor: r.is_mentor,
    mentorTopics: r.mentor_topics ?? [],
    openToReferrals: r.open_to_referrals,
    mutualConnections: r.mutual_connections,
    // The written part. `contributed` is what the UI uses to separate "shared
    // their advice" from "timeline only" — a contribution row with empty text
    // should not earn the badge, so it is derived from content, not existence.
    contributed: !!(r.contrib_headline || r.contrib_advice || arr(r.contrib_stages).length),
    roleGoal: r.contrib_role || r.designation,
    headline: r.contrib_headline ?? '',
    stages: arr(r.contrib_stages),
    advice: r.contrib_advice ?? '',
    // When they last wrote it — drives the "3 days ago" line on the roadmap
    // feed. Undefined for a derived-only timeline, which has no such moment.
    updatedAt: r.contrib_updated_at
      ? new Date(r.contrib_updated_at).toISOString()
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Career Guidance
// ---------------------------------------------------------------------------

export interface CareerAssessmentRow {
  id: string
  status: 'draft' | 'submitted'
  current_situation: string
  goal_type: string
  target_role: string
  target_role_unsure: boolean
  hours_per_week: number | null
  timeline_months: number | null
  extra_skills_note: string
  learning_prefs: string[]
  support_preference: string
  help_types: string[]
  free_text: string
  created_at: Date | string
  updated_at: Date | string
}

export function mapCareerAssessment(r: CareerAssessmentRow) {
  return {
    id: r.id,
    status: r.status,
    currentSituation: r.current_situation,
    goalType: r.goal_type,
    targetRole: r.target_role,
    targetRoleUnsure: r.target_role_unsure,
    hoursPerWeek: r.hours_per_week ?? undefined,
    timelineMonths: r.timeline_months ?? undefined,
    extraSkillsNote: r.extra_skills_note,
    learningPrefs: r.learning_prefs ?? [],
    supportPreference: r.support_preference,
    helpTypes: r.help_types ?? [],
    freeText: r.free_text,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export interface CareerRoadmapRow {
  id: string
  version: number
  status: 'active' | 'archived'
  data: unknown
  created_at: Date | string
}

/** `data` already holds { goal, timelineMonths, hoursPerWeek, stages } — see
 * careerRoadmap.ts for what writes it. The row's own id/version/status are
 * merged on top so the frontend gets one flat, self-contained object. */
export function mapCareerRoadmap(r: CareerRoadmapRow) {
  const data = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>
  return {
    roadmapId: r.id,
    version: r.version,
    status: r.status,
    goal: data.goal ?? { currentRole: '', targetRole: '' },
    timelineMonths: data.timelineMonths ?? 0,
    hoursPerWeek: data.hoursPerWeek ?? 0,
    stages: Array.isArray(data.stages) ? data.stages : [],
    createdAt: new Date(r.created_at).toISOString(),
  }
}

export interface AlumniServiceRow {
  id: string
  user_id: string
  service_type: string
  title: string
  description: string
  tags: string[]
  pricing_mode: 'free' | 'paid' | 'custom'
  amount: number | null
  pricing_unit: 'hour' | 'session' | null
  active: boolean
  created_at: Date | string
  updated_at: Date | string
  // Present only when the query joins users for card display; absent on the
  // provider's own "manage my services" list, which already knows who it is.
  provider_name?: string
  provider_photo?: string | null
  provider_designation?: string
  provider_company?: string
}

export function mapAlumniService(r: AlumniServiceRow) {
  return {
    id: r.id,
    userId: r.user_id,
    serviceType: r.service_type,
    title: r.title,
    description: r.description,
    tags: r.tags ?? [],
    pricingMode: r.pricing_mode,
    amount: r.amount ?? undefined,
    pricingUnit: r.pricing_unit ?? undefined,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    providerName: r.provider_name,
    providerPhoto: r.provider_photo ?? undefined,
    providerDesignation: r.provider_designation,
    providerCompany: r.provider_company,
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
  // Invite delivery tracking (see invites.routes.ts). Null/absent on an
  // invitee who has never been sent one.
  invited_at?: Date | null
  invite_status?: string | null
  invite_error?: string | null
  invite_count?: number | null
  batch_label?: string | null
  // Joined from users at query time — an invited member's account state.
  has_account?: boolean | null
  password_changed?: boolean | null
  last_login_at?: Date | null
  ever_active?: boolean | null
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
    invitedAt: r.invited_at ? new Date(r.invited_at).toISOString() : null,
    // invited_at with no recorded status means the send predates per-recipient
    // tracking. It WAS emailed (nothing else writes invited_at), so report it
    // as sent rather than as never-invited — the outcome just wasn't captured.
    inviteStatus: (r.invite_status ?? (r.invited_at ? 'sent' : null)) as
      | 'sent'
      | 'failed'
      | 'simulated'
      | null,
    inviteError: r.invite_error ?? null,
    inviteCount: r.invite_count ?? 0,
    // Which import this person arrived in. '' = predates batch tracking.
    batch: r.batch_label ?? '',
    // The exact link that was mailed — derived from the address rather than
    // stored, so it can't drift out of sync with what the sender builds.
    inviteLink: inviteLinkFor(r.email),
    hasAccount: !!r.has_account,
    // False while they're still on the password we generated for them.
    passwordChanged: !!r.password_changed,
    // Recorded fact, not an inference — null means they have genuinely never
    // signed in (or did so before login stamping existed).
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    // Has demonstrably used the account (onboarded / edited their profile),
    // even when no login timestamp was captured.
    everActive: !!r.ever_active,
  }
}
