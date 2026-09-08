// The rich-profile half of the member's data, shared by the two places that
// collect it: the onboarding wizard and Edit Profile. Both render the same
// <ProfileDetailSections> over this one value shape, so the two paths cannot
// drift apart the way the original field lists did.
//
// The existing basic fields (name, city, company, bio, skills…) are NOT part of
// this — each form keeps its own long-standing state for those, untouched.

import type {
  AchievementEntry,
  ProfileTag,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  MentorshipMode,
  ProfileLink,
  ProjectEntry,
  ResumeParseResult,
  StartupIntent,
  User,
  WorkMode,
} from '../types'

export interface ProfileDetailValue {
  // Resume-parseable
  experience: ExperienceEntry[]
  education: EducationEntry[]
  projects: ProjectEntry[]
  certifications: CertificationEntry[]
  achievements: AchievementEntry[]
  otherLinks: ProfileLink[]
  languagesKnown: string[]
  github: string
  portfolio: string
  industry: string
  // Preferences
  workMode: WorkMode | ''
  openToRelocate: boolean
  interests: string[]
  openToSpeakAtEvents: boolean
  roomanCenter: string
  // Mentorship — only collected while willingToMentor is on
  mentorTopics: string[]
  mentorAvailability: string
  mentorshipMode: MentorshipMode | ''
  // Referrals & hiring
  openToReferrals: boolean
  referralNote: string
  hiringFor: string[]
  // StartupVarsity — only collected while interestedInStartup is on
  startupIntent: StartupIntent | ''
  startupLookingFor: string[]
  // Contact visibility — both private by default
  showEmail: boolean
  showPhone: boolean
  // Sensitive personal details — stored, private by default, each lockable
  homeAddress: string
  dateOfBirth: string
  salaryCurrent: string
  salaryExpected: string
  showAddress: boolean
  showAge: boolean
  showSalary: boolean
  // Private to the owner
  noticePeriod: string
  preferredLocations: string[]
  seekingMentorshipIn: string[]
}

export const EMPTY_DETAIL: ProfileDetailValue = {
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  achievements: [],
  otherLinks: [],
  languagesKnown: [],
  github: '',
  portfolio: '',
  industry: '',
  workMode: '',
  openToRelocate: false,
  interests: [],
  openToSpeakAtEvents: false,
  roomanCenter: '',
  mentorTopics: [],
  mentorAvailability: '',
  mentorshipMode: '',
  openToReferrals: false,
  referralNote: '',
  hiringFor: [],
  startupIntent: '',
  startupLookingFor: [],
  showEmail: false,
  showPhone: false,
  homeAddress: '',
  dateOfBirth: '',
  salaryCurrent: '',
  salaryExpected: '',
  showAddress: false,
  showAge: false,
  showSalary: false,
  noticePeriod: '',
  preferredLocations: [],
  seekingMentorshipIn: [],
}

/** Seed the editor from a stored profile. */
export function detailFromUser(user: User): ProfileDetailValue {
  return {
    experience: user.experience ?? [],
    education: user.education ?? [],
    projects: user.projects ?? [],
    certifications: user.certifications ?? [],
    achievements: user.achievements ?? [],
    otherLinks: user.otherLinks ?? [],
    languagesKnown: user.languagesKnown ?? [],
    github: user.github ?? '',
    portfolio: user.portfolio ?? '',
    industry: user.industry ?? '',
    workMode: user.workMode ?? '',
    openToRelocate: !!user.openToRelocate,
    interests: user.interests ?? [],
    openToSpeakAtEvents: !!user.openToSpeakAtEvents,
    roomanCenter: user.roomanCenter ?? '',
    mentorTopics: user.mentorTopics ?? [],
    mentorAvailability: user.mentorAvailability ?? '',
    mentorshipMode: user.mentorshipMode ?? '',
    openToReferrals: !!user.openToReferrals,
    referralNote: user.referralNote ?? '',
    hiringFor: user.hiringFor ?? [],
    startupIntent: user.startupIntent ?? '',
    startupLookingFor: user.startupLookingFor ?? [],
    showEmail: !!user.showEmail,
    showPhone: !!user.showPhone,
    homeAddress: user.homeAddress ?? '',
    dateOfBirth: user.dateOfBirth ?? '',
    salaryCurrent: user.salaryCurrent ? String(user.salaryCurrent) : '',
    salaryExpected: user.salaryExpected ? String(user.salaryExpected) : '',
    showAddress: !!user.showAddress,
    showAge: !!user.showAge,
    showSalary: !!user.showSalary,
    noticePeriod: user.noticePeriod ?? '',
    preferredLocations: user.preferredLocations ?? [],
    seekingMentorshipIn: user.seekingMentorshipIn ?? [],
  }
}

/**
 * Turn the editor value into a PATCH /api/users/me body.
 *
 * `willingToMentor` / `interestedInStartup` are owned by the surrounding form.
 * When either is off, the fields under it are cleared rather than left behind
 * — the same rule the existing Current Status switch follows, so a stale
 * mentor rate or startup intent can't keep matching people after the member
 * has opted out.
 */
export function detailToPatch(
  d: ProfileDetailValue,
  opts: {
    willingToMentor: boolean
    interestedInStartup: boolean
    /** Admin-verified mentor — required before the Mentor label is attached. */
    mentorVerified: boolean
    /** Derived from Current Status, which the surrounding form owns. */
    openToWork: boolean
  },
): Partial<User> {
  return {
    experience: d.experience,
    education: d.education,
    projects: d.projects,
    certifications: d.certifications,
    achievements: d.achievements,
    otherLinks: d.otherLinks,
    languagesKnown: d.languagesKnown,
    github: d.github.trim(),
    portfolio: d.portfolio.trim(),
    industry: d.industry,
    workMode: (d.workMode || undefined) as WorkMode | undefined,
    openToRelocate: d.openToRelocate,
    interests: d.interests,
    openToSpeakAtEvents: d.openToSpeakAtEvents,
    roomanCenter: d.roomanCenter.trim(),
    mentorTopics: opts.willingToMentor ? d.mentorTopics : [],
    mentorAvailability: opts.willingToMentor ? d.mentorAvailability.trim() : '',
    mentorshipMode: (opts.willingToMentor ? d.mentorshipMode || undefined : undefined) as
      | MentorshipMode
      | undefined,
    openToReferrals: d.openToReferrals,
    referralNote: d.openToReferrals ? d.referralNote.trim() : '',
    hiringFor: d.hiringFor,
    startupIntent: (opts.interestedInStartup ? d.startupIntent || undefined : undefined) as
      | StartupIntent
      | undefined,
    startupLookingFor: opts.interestedInStartup ? d.startupLookingFor : [],
    showEmail: d.showEmail,
    showPhone: d.showPhone,
    homeAddress: d.homeAddress.trim(),
    // '' clears the date; the route turns it into NULL.
    dateOfBirth: d.dateOfBirth,
    salaryCurrent: d.salaryCurrent ? Number(d.salaryCurrent) : undefined,
    salaryExpected: d.salaryExpected ? Number(d.salaryExpected) : undefined,
    showAddress: d.showAddress,
    showAge: d.showAge,
    showSalary: d.showSalary,
    noticePeriod: d.noticePeriod.trim(),
    preferredLocations: d.preferredLocations,
    seekingMentorshipIn: d.seekingMentorshipIn,
    // Labels follow the answers above — see derivedProfileTags.
    profileTags: derivedProfileTags(d, {
      willingToMentor: opts.willingToMentor,
      mentorVerified: opts.mentorVerified,
      openToWork: opts.openToWork,
    }),
  }
}

/**
 * Merge a resume parse into the editor value.
 *
 * Same rule as the basic fields in the onboarding wizard: the parse only fills
 * what is still EMPTY. A member who has already typed or corrected something
 * never has it overwritten by a re-upload, and lists are only adopted wholesale
 * when the member has none of their own.
 */
export function mergeResumeIntoDetail(
  d: ProfileDetailValue,
  r: ResumeParseResult,
  industries: readonly string[],
): ProfileDetailValue {
  const takeList = <T>(mine: T[], parsed: T[] | undefined) =>
    mine.length > 0 ? mine : (parsed ?? [])

  return {
    ...d,
    experience: takeList(d.experience, r.experience),
    education: takeList(d.education, r.education),
    projects: takeList(d.projects, r.projects),
    certifications: takeList(d.certifications, r.certifications),
    achievements: takeList(d.achievements, r.achievements),
    languagesKnown: takeList(d.languagesKnown, r.languagesKnown),
    interests: takeList(d.interests, r.interests),
    github: d.github || r.github || '',
    portfolio: d.portfolio || r.portfolio || '',
    // Guard the enum: a free model can return a value outside the allowed list.
    industry: d.industry || (industries.includes(r.industry) ? r.industry : ''),
  }
}

/**
 * The profile labels a member's own answers earn them, derived rather than
 * picked from a list. Ticking "willing to give referrals" IS the referral tag;
 * listing roles you're hiring for IS the hiring tag. Deriving them keeps the
 * badge and the data that backs it from ever disagreeing.
 *
 * `Mentor` is the exception that proves the rule: it needs admin-verified
 * credentials, so it comes from the verified flag and not from the member's
 * own say-so.
 */
export function derivedProfileTags(
  d: ProfileDetailValue,
  opts: { willingToMentor: boolean; mentorVerified: boolean; openToWork: boolean },
): ProfileTag[] {
  const tags: ProfileTag[] = []
  if (opts.willingToMentor && opts.mentorVerified) tags.push('Mentor')
  if (d.hiringFor.length > 0) tags.push('Hiring')
  if (opts.openToWork) tags.push('Open to Work')
  if (d.openToReferrals) tags.push('Willing to give referral')
  if (d.seekingMentorshipIn.length > 0) tags.push('Need mentorship')
  return tags
}
