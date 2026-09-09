// Which profile fields are mandatory, in one place.
//
// Onboarding and Edit Profile both read these rules, so the two can't drift:
// a field you must supply at signup is a field you can't blank out later.
//
// Two ideas kept separate on purpose:
//   - REQUIRED (here) = you cannot finish without it.
//   - SCORED (profileCompleteness.ts) = it moves your completeness percentage.
// Education, projects and certifications are heavily scored but NOT required —
// a fresher shouldn't be blocked from joining the network over them.
//
// Conditional rules follow the member's Current Status and their two opt-in
// toggles, so nobody is asked for an employer they don't have.

import { statusOf, type EmploymentType } from '../types'

/** The shape both forms can supply — a superset of each one's own state. */
export interface RequiredCheckInput {
  name: string
  email: string
  phone: string
  batchYear: string
  course: string
  employmentType: EmploymentType | ''
  domain: string
  company: string
  designation: string
  college: string
  experienceYears: string
  city: string
  photo?: string | null
  linkedin: string
  bio: string
  /** Comma-joined or already split — both forms keep it as text. */
  expertise: string
  interests: string[]
  achievements: { title: string; year: string }[]
  willingToMentor: boolean
  mentorTopics: string[]
  mentorAvailability: string
  mentorshipMode: string
  seekingMentorshipIn: string[]
  interestedInStartup: boolean
  startupIntent: string
  startupLookingFor: string[]
}

export interface RequiredField {
  /** Which wizard step it lives on, so the caller can gate that step. */
  step: 'basic' | 'status' | 'setup' | 'interests' | 'detail'
  /** Shown verbatim in the "still needed" list. */
  label: string
}

const blank = (v?: string | null) => !v || v.trim().length === 0

/**
 * Everything still missing. Empty array = the member can finish.
 * Order matters: it's the order the UI lists them in.
 */
export function missingRequired(v: RequiredCheckInput): RequiredField[] {
  const out: RequiredField[] = []
  const need = (step: RequiredField['step'], cond: boolean, label: string) => {
    if (cond) out.push({ step, label })
  }

  // --- Basic info: all of it -----------------------------------------------
  need('basic', blank(v.name) || v.name === 'You', 'Your full name')
  need('basic', blank(v.email), 'Your email address')
  need('basic', blank(v.phone), 'Your phone number')
  need('basic', !/^\d{4}$/.test(v.batchYear.trim()), 'Your batch year')
  need('basic', blank(v.course), 'Your Rooman course')

  // --- Current status: all of it, adapted to the status --------------------
  const status = statusOf(v.employmentType)
  need('status', status === '', 'Your current status')
  need('status', blank(v.domain), 'Your expertise domain')

  if (status === 'Working Professional') {
    need('status', blank(v.company), 'Your current company')
    need('status', blank(v.designation), 'Your designation')
    need('status', blank(v.experienceYears), 'Your years of experience')
  } else if (status === 'Student') {
    need('status', blank(v.college), 'Your college or institution')
  } else if (status === 'Looking for opportunity') {
    need('status', blank(v.experienceYears), 'Your years of experience')
  }
  // 'Just looking around' asks for nothing beyond the status itself.

  // --- Profile setup: all of it --------------------------------------------
  need('setup', blank(v.city), 'Your city')
  need('setup', blank(v.photo), 'A profile photo')
  need('setup', blank(v.linkedin), 'Your LinkedIn URL')
  need('setup', v.bio.trim().length < 40, 'A bio of at least 40 characters')
  need(
    'setup',
    v.expertise.split(',').filter((s) => s.trim()).length < 3,
    'At least 3 skills',
  )

  // --- Interests + achievements --------------------------------------------
  // Both inputs live in the shared <ProfileDetailSections>, which the wizard
  // renders on its LAST step — so they belong to 'detail'. Keying interests to
  // the 'interests' step made that step ungateable: it holds the two opt-in
  // toggles, and a member who skipped the resume import had no way to satisfy
  // a requirement whose input was still a step away.
  need('detail', v.interests.length === 0, 'A few interests outside work')
  need(
    'detail',
    v.achievements.filter((a) => !blank(a.title)).length === 0,
    'At least one achievement',
  )

  // --- Opt-in blocks: only once the member switched them on ----------------
  if (v.willingToMentor) {
    need('detail', v.mentorTopics.length === 0, 'The topics you can mentor on')
    need('detail', blank(v.mentorAvailability), 'How much time you have for mentoring')
    need('detail', blank(v.mentorshipMode), 'How you prefer to mentor')
    need('detail', v.seekingMentorshipIn.length === 0, 'What you want mentorship in')
  }
  if (v.interestedInStartup) {
    need('detail', blank(v.startupIntent), 'Where you are with your startup idea')
    need('detail', v.startupLookingFor.length === 0, 'What you are looking for')
  }

  return out
}

/** Whether a given wizard step still has something outstanding. */
export function stepBlocked(v: RequiredCheckInput, step: RequiredField['step']): boolean {
  return missingRequired(v).some((m) => m.step === step)
}
