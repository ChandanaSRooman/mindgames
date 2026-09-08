// Profile completeness scoring.
//
// Design rules, in priority order:
//
// 1. WEIGHTS FOLLOW THE ROLE. What "a good profile" means depends on who you
//    are, so each role weights the same buckets differently (see ROLE_WEIGHTS):
//    a student is judged mostly on education and projects, a working
//    professional on their work history, a job-seeker on proof of work and
//    availability, and someone just exploring on barely anything. A verified
//    mentor additionally has to say what they can teach.
//
// 2. SCORE WHAT MATTERS. The small fields — Rooman centre, industry, work
//    mode, languages, extra links, the sensitive details — are collected but
//    NEVER scored. Filling in every tiny field should not be the price of a
//    complete profile.
//
// 3. THE DENOMINATOR IS DYNAMIC. A bucket weighted 0 for your role, or one
//    that cannot apply to you, is dropped and the rest reweighted — so every
//    role can reach a true 100%.
//
// 4. PARTIAL CREDIT. A bucket earns weight * (passed / total), so one missing
//    item never costs a whole bucket.
//
// Booleans are deliberately never checks: `openToRelocate: false` is a real
// answer and is indistinguishable from "never asked", so scoring it would
// punish people for answering honestly.

import { MENTOR_CLAIM_LABELS, statusOf, type MentorClaim, type User } from '../types'

export interface CompletenessCheck {
  /** Imperative, shown verbatim in the "what's missing" list. */
  label: string
  ok: boolean
  /** Percentage points this single check is worth, after normalisation. */
  delta: number
}

export interface CompletenessBucket {
  key: string
  label: string
  weight: number
  checks: CompletenessCheck[]
  /** 0-1 within the bucket. */
  ratio: number
}

export interface Completeness {
  /** 0-100, normalised over the buckets that apply to this member. */
  percent: number
  buckets: CompletenessBucket[]
  /** Failed checks, richest first — the meter shows the top few. */
  missing: CompletenessCheck[]
}

/** Activity lives outside the user row, so the caller supplies it. */
export interface ProfileActivity {
  /** How many posts this member has authored. */
  postCount?: number
}

const filled = (v?: string | null) => !!v && v.trim().length > 0
const some = (v?: unknown[]) => !!v && v.length > 0

interface BucketSpec {
  key: string
  label: string
  weight: number
  applies: boolean
  checks: { label: string; ok: boolean }[]
}

/**
 * The roles a profile is scored against. Derived, not stored: it follows the
 * member's Current Status, except that a verified mentor is scored as a mentor
 * whatever else they are, because mentoring is the commitment with someone
 * else's time attached to it.
 */
export type ProfileRole = 'mentor' | 'student' | 'working' | 'seeking' | 'exploring'

export function profileRole(user: User): ProfileRole {
  if (user.isMentor && user.mentorVerified) return 'mentor'
  switch (statusOf(user.employmentType)) {
    case 'Student':
      return 'student'
    case 'Working Professional':
      return 'working'
    case 'Looking for opportunity':
      return 'seeking'
    default:
      return 'exploring'
  }
}

type BucketKey =
  | 'identity'
  | 'about'
  | 'education'
  | 'proof'
  | 'activity'
  | 'links'
  | 'role'
  | 'mentoring'
  | 'availability'

/**
 * Per-role bucket weights. Each row sums to 100; a 0 drops the bucket out of
 * the denominator entirely.
 *
 *  - student   — education and projects are the whole story; there is no job.
 *  - working   — the work history carries it, and employers are asked for.
 *  - seeking   — proof of work plus the availability details a recruiter needs.
 *  - mentor    — credibility (education + history) plus what they can teach.
 *  - exploring — deliberately shallow: someone browsing owes the network
 *                almost nothing, and nagging them for a portfolio is how you
 *                lose them.
 */
const ROLE_WEIGHTS: Record<ProfileRole, Record<BucketKey, number>> = {
  student:   { identity: 15, about: 15, education: 25, proof: 30, activity: 10, links: 5,  role: 0,  mentoring: 0,  availability: 0 },
  working:   { identity: 15, about: 15, education: 10, proof: 15, activity: 10, links: 5,  role: 30, mentoring: 0,  availability: 0 },
  seeking:   { identity: 15, about: 15, education: 15, proof: 25, activity: 5,  links: 10, role: 0,  mentoring: 0,  availability: 15 },
  mentor:    { identity: 10, about: 15, education: 15, proof: 10, activity: 10, links: 5,  role: 15, mentoring: 20, availability: 0 },
  exploring: { identity: 40, about: 35, education: 15, proof: 0,  activity: 5,  links: 5,  role: 0,  mentoring: 0,  availability: 0 },
}

export function profileCompleteness(user: User, activity: ProfileActivity = {}): Completeness {
  const status = statusOf(user.employmentType)
  const role = profileRole(user)
  const w = ROLE_WEIGHTS[role]
  // Only these two statuses have a current role to describe at all.
  const asksEmployer = status === 'Working Professional'
  const asksCollege = status === 'Student'

  const specs: BucketSpec[] = [
    {
      key: 'identity',
      label: 'Who you are',
      weight: w.identity,
      applies: w.identity > 0,
      checks: [
        { label: 'Add a profile photo', ok: filled(user.photo) },
        { label: 'Add your city', ok: filled(user.city) },
        { label: 'Add your batch year', ok: user.batchYear > 0 },
        { label: 'Add your Rooman course', ok: filled(user.course) },
      ],
    },
    {
      key: 'about',
      label: 'About you',
      weight: w.about,
      applies: w.about > 0,
      checks: [
        { label: 'Write a bio of at least 40 characters', ok: (user.bio ?? '').trim().length >= 40 },
        { label: 'List at least 3 skills', ok: (user.expertise ?? []).length >= 3 },
      ],
    },
    {
      key: 'education',
      label: 'Education',
      weight: w.education,
      applies: w.education > 0,
      checks: [{ label: 'Add your degree or diploma', ok: some(user.education) }],
    },
    {
      key: 'proof',
      label: 'Proof of work',
      weight: w.proof,
      applies: w.proof > 0,
      checks: [
        { label: 'Add a project you have built', ok: some(user.projects) },
        { label: 'Add a certification you have earned', ok: some(user.certifications) },
      ],
    },
    {
      key: 'activity',
      label: 'Activity',
      weight: w.activity,
      applies: w.activity > 0,
      checks: [
        {
          // Unknown post count counts as none: the meter is only rendered where
          // the caller knows, and guessing "yes" would inflate the score.
          label: 'Share your first post',
          ok: (activity.postCount ?? 0) > 0,
        },
      ],
    },
    {
      key: 'links',
      label: 'Links',
      weight: w.links,
      applies: w.links > 0,
      checks: [
        {
          label: 'Add a LinkedIn, GitHub or portfolio link',
          ok: filled(user.linkedin) || filled(user.github) || filled(user.portfolio),
        },
      ],
    },
    {
      key: 'role',
      label: asksCollege ? 'Where you study' : 'Where you work',
      weight: w.role,
      applies: w.role > 0 && (asksEmployer || asksCollege),
      checks: asksCollege
        ? [{ label: 'Add your college or institution', ok: filled(user.college) }]
        : [
            {
              label: 'Add your current designation and company',
              ok: filled(user.designation) && filled(user.company),
            },
            { label: 'Add a role to your work history', ok: some(user.experience) },
          ],
    },
    {
      // Mentors only: a mentee cannot book against a blank offer.
      key: 'mentoring',
      label: 'Your mentoring offer',
      weight: w.mentoring,
      applies: w.mentoring > 0,
      checks: [
        { label: 'List the topics you can mentor on', ok: some(user.mentorTopics) },
        { label: 'Say how much time you have for mentoring', ok: filled(user.mentorAvailability) },
      ],
    },
    {
      // Job-seekers only: the details that decide whether a recruiter or an
      // alum can act on an "Open to Work" profile at all.
      key: 'availability',
      label: 'Your availability',
      weight: w.availability,
      applies: w.availability > 0,
      checks: [
        { label: 'Say when you could join', ok: filled(user.noticePeriod) },
        { label: 'Add the locations you would work in', ok: some(user.preferredLocations) },
        { label: 'Pick your preferred work mode', ok: filled(user.workMode) },
      ],
    },
  ]

  const active = specs.filter((s) => s.applies && s.checks.length > 0)
  const totalWeight = active.reduce((sum, s) => sum + s.weight, 0) || 1

  const buckets: CompletenessBucket[] = active.map((s) => {
    const per = (s.weight / s.checks.length / totalWeight) * 100
    return {
      key: s.key,
      label: s.label,
      weight: s.weight,
      ratio: s.checks.filter((c) => c.ok).length / s.checks.length,
      checks: s.checks.map((c) => ({ label: c.label, ok: c.ok, delta: per })),
    }
  })

  const earned = buckets.reduce((sum, b) => sum + b.ratio * b.weight, 0)

  return {
    percent: Math.round((earned / totalWeight) * 100),
    buckets,
    missing: buckets
      .flatMap((b) => b.checks)
      .filter((c) => !c.ok)
      .sort((a, b) => b.delta - a.delta),
  }
}

// ---------------------------------------------------------------------------
// Mentor verification.
//
// Mentoring is the one thing here that can't be self-declared: a mentee books
// real time on the strength of it. The member claims ONE requirement — 2+
// years of professional experience, a postgraduate degree, or a passed
// assessment — attaches evidence, and an admin verifies it.
//
// `user.mentorVerified` (users.mentor_verified_at) is the only thing that
// unlocks mentoring. The self-declared checks below are NOT eligibility: they
// only tell the member which claim their profile already supports, so the
// application form can suggest the one most likely to be approved.
// ---------------------------------------------------------------------------

/** Pass mark for the mentor assessment, out of 100. */
export const MENTOR_ASSESSMENT_PASS_MARK = 60

/** Professional experience, in years, that a claim can be based on. */
export const MENTOR_MIN_EXPERIENCE_YEARS = 2

// Matches postgraduate qualifications as written on real Indian resumes.
// The \b anchors are load-bearing: without the leading one, `m\s?a` matches the
// "ma" inside "Diploma" and every diploma holder would look postgraduate.
const POSTGRAD_RE =
  /\b(m\.?\s?tech|m\.?\s?e|m\.?\s?s|m\.?\s?sc|msc|m\.?\s?c\.?\s?a|mba|pgdm|m\.?\s?com|m\.?\s?a|master(?:'?s)?|ph\.?\s?d|doctorate)\b/i

export function hasPostgraduateDegree(user: User): boolean {
  return (user.education ?? []).some((e) => POSTGRAD_RE.test(e.degree ?? ''))
}

export interface MentorRequirement {
  key: MentorClaim
  label: string
  /** True when the member's own profile already points at this claim. */
  supportedByProfile: boolean
}

export interface MentorEligibility {
  /** The only real gate: an admin has verified the evidence. */
  eligible: boolean
  requirements: MentorRequirement[]
}

export function mentorEligibility(user: User): MentorEligibility {
  return {
    eligible: !!user.mentorVerified,
    requirements: [
      {
        key: 'experience',
        label: MENTOR_CLAIM_LABELS.experience,
        supportedByProfile: (user.experienceYears ?? 0) >= MENTOR_MIN_EXPERIENCE_YEARS,
      },
      {
        key: 'postgrad',
        label: MENTOR_CLAIM_LABELS.postgrad,
        supportedByProfile: hasPostgraduateDegree(user),
      },
      {
        key: 'assessment',
        label: MENTOR_CLAIM_LABELS.assessment,
        supportedByProfile: (user.mentorAssessmentScore ?? -1) >= MENTOR_ASSESSMENT_PASS_MARK,
      },
    ],
  }
}

/**
 * Who appears on the Mentors tab: a member who is listed as a mentor AND whose
 * credentials an admin verified.
 *
 * Deliberately does NOT also require mentor topics or availability. Those make
 * a mentor easier to book and the completeness meter asks for them, but
 * withholding someone from the list over a blank field would hide real,
 * verified mentors — including ones who already have sessions booked.
 */
export function isBookableMentor(user: User): boolean {
  return !!user.isMentor && !!user.mentorVerified
}

// ---------------------------------------------------------------------------
// What completeness and eligibility actually change. Every entry here is
// something the code really does, so the UI can show it without lying.
// ---------------------------------------------------------------------------

export interface ProfileGate {
  label: string
  met: boolean
  /** Enforced gates are hard rules; the rest are ranking/visibility effects. */
  enforced: boolean
}

export function profileGates(user: User, percent: number): ProfileGate[] {
  return [
    {
      label: 'Be listed and bookable as a mentor',
      met: isBookableMentor(user),
      enforced: true,
    },
    {
      // Not a gate — mentor cards and the booking dialog read these, so an
      // empty pair makes you far harder to actually book.
      label: 'Give mentees your topics and availability to book against',
      met: (user.mentorTopics ?? []).length > 0 || filled(user.mentorAvailability),
      enforced: false,
    },
    {
      label: "Show your own story on your company's alumni page",
      met: some(user.experience),
      enforced: true,
    },
    {
      label: "Show what you're building, and what you need for it",
      met: !!user.interestedInStartup && filled(user.startupIntent),
      enforced: true,
    },
    {
      label: 'Rank higher in suggestions, search and mentor lists',
      met: percent >= 100,
      enforced: false,
    },
    {
      label: 'Earn the Complete Profile badge',
      met: percent >= 100,
      enforced: false,
    },
  ]
}
