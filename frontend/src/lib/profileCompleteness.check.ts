// Sanity checks for completeness scoring and mentor eligibility. Run with:
//   npm --prefix frontend run check
import assert from 'node:assert'
import {
  hasPostgraduateDegree,
  mentorEligibility,
  isBookableMentor,
  profileCompleteness,
  profileRole,
} from './profileCompleteness'
import type { User } from '../types'

const base: User = {
  id: 'u1',
  name: 'Test User',
  email: 'a@b.com',
  avatar: '',
  batchYear: 0,
  course: '',
  company: '',
  designation: '',
  experienceYears: 0,
  domain: 'Web Dev',
  employmentType: 'Employed',
  city: '',
  bio: '',
  expertise: [],
  willingToMentor: false,
  interestedInStartup: false,
  connectionsCount: 0,
  isMentor: false,
}

// --- what counts, and what deliberately doesn't ---------------------------

assert.equal(profileCompleteness(base).percent, 0)

// The optional fields must not move the number at all. If this fails, someone
// has started scoring the small stuff again.
const withOnlyExtras: User = {
  ...base,
  roomanCenter: 'Bengaluru — Jayanagar',
  industry: 'Fintech',
  workMode: 'Remote',
  openToRelocate: true,
  languagesKnown: ['English', 'Hindi', 'Kannada'],
  interests: ['Cricket'],
  openToSpeakAtEvents: true,
  achievements: [{ title: 'Award', year: '2020' }],
  otherLinks: [{ label: 'Blog', url: 'https://b.example' }],
  noticePeriod: '2 months',
  preferredLocations: ['Bengaluru'],
  mentorTopics: ['System design'],
  startupIntent: 'Have an idea',
}
assert.equal(
  profileCompleteness(withOnlyExtras).percent,
  0,
  'optional detail must never contribute to the score',
)

// A working professional with everything scored filled in reaches exactly 100.
const pro: User = {
  ...base,
  photo: 'data:image/jpeg;base64,x',
  city: 'Bengaluru',
  batchYear: 2019,
  course: 'Full-Stack Dev',
  bio: 'Backend engineer who likes databases and mentoring juniors on system design.',
  expertise: ['Node.js', 'Postgres', 'AWS'],
  education: [{ degree: 'B.E. Computer Science', institution: 'VTU', year: '2019' }],
  projects: [{ title: 'Ledger', description: 'Bookkeeping API', tech: ['Node'] }],
  certifications: [{ name: 'AWS SAA', issuer: 'AWS', year: '2021' }],
  linkedin: 'https://linkedin.com/in/asha',
  designation: 'SDE II',
  company: 'Acme',
  experience: [{ role: 'SDE II', company: 'Acme', period: '2021 —', summary: 'Built things.' }],
}
assert.equal(profileCompleteness(pro, { postCount: 3 }).percent, 100)

// --- nobody is penalised for a status that doesn't apply to them ----------

// A student has no employer and no work history, and still reaches 100.
const student: User = {
  ...base,
  employmentType: 'Student',
  photo: 'data:image/jpeg;base64,x',
  city: 'Mysuru',
  batchYear: 2024,
  course: 'Cloud Computing',
  college: 'RV College',
  bio: 'Final-year student building small tools and learning cloud infrastructure.',
  expertise: ['Python', 'Docker', 'Linux'],
  education: [{ degree: 'B.E. Information Science', institution: 'RVCE', year: '2025' }],
  projects: [{ title: 'Attendance bot', description: 'Telegram bot', tech: ['Python'] }],
  certifications: [{ name: 'AZ-900', issuer: 'Microsoft', year: '2024' }],
  github: 'https://github.com/student',
}
assert.equal(
  profileCompleteness(student, { postCount: 1 }).percent,
  100,
  'a student must be able to reach 100% with no work experience',
)

// A job-hunting fresher is asked about neither an employer nor a college. They
// ARE asked for availability, because that is what makes an "open to work"
// profile actionable — and with it they reach 100 on education, projects,
// certifications, a post and availability alone.
// A job-seeker is asked where they STUDIED, not for a work history they may
// not have, plus the availability details that make the profile actionable.
const fresher: User = { ...student, employmentType: 'Looking for opportunity' }
assert.ok(
  profileCompleteness(fresher, { postCount: 1 }).percent < 100,
  'a job-seeker without availability details is not finished',
)
assert.equal(
  profileCompleteness(
    { ...fresher, noticePeriod: 'Immediately', preferredLocations: ['Bengaluru'], workMode: 'Remote' },
    { postCount: 1 },
  ).percent,
  100,
  'a fresher with a college and availability must be able to reach 100%',
)
// And they are never asked for an employer.
assert.ok(
  !profileCompleteness(fresher).missing.some((m) => m.label.includes('company')),
  'a job-seeker must not be asked for a current company',
)

// Education, projects and certifications carry real weight for everyone who
// is scored on them — and much more for a student than for someone employed,
// which is the whole point of the per-role table.
const noProof = (u: User) =>
  profileCompleteness({ ...u, education: [], projects: [], certifications: [] }, { postCount: 3 })
    .percent
const studentCost = 100 - noProof({ ...student, experience: [] })
const workingCost = 100 - noProof(pro)
// Student: education(20) + proof(25) = 45. Working: education(10) + proof(15) = 25.
assert.ok(studentCost >= 40, `a student should lose 40+ points without them, lost ${studentCost}`)
assert.ok(workingCost >= 20, `a working member should still lose 20+, lost ${workingCost}`)
assert.ok(
  studentCost > workingCost,
  'education and projects must matter more to a student than to someone employed',
)

// Posting counts for everyone, and is worth a visible chunk.
assert.ok(
  profileCompleteness(pro, { postCount: 0 }).percent < profileCompleteness(pro, { postCount: 1 }).percent,
  'a first post should move the number',
)

// The missing list is ordered richest-first so the meter's top three are the
// three most valuable things to do next.
const deltas = profileCompleteness(base).missing.map((m) => m.delta)
assert.deepEqual(deltas, [...deltas].sort((a, b) => b - a))

// --- weights follow the role ---------------------------------------------

// The same PARTIAL profile scores differently per role, because different
// things matter to each. (A complete profile is 100 for everyone — the
// weighting shows up in what is still missing, not in the ceiling.)
// Here: education is present, proof of work is not.
const partial: User = { ...pro, projects: [], certifications: [] }
const asStudent = profileCompleteness(
  { ...partial, employmentType: 'Student', college: 'RVCE' },
  { postCount: 3 },
).percent
const asWorking = profileCompleteness(partial, { postCount: 3 }).percent
assert.ok(
  asStudent < asWorking,
  `missing projects should hurt a student (${asStudent}%) more than someone employed (${asWorking}%)`,
)

// A student is scored on education + projects, not on an employer.
const studentNoEmployer: User = {
  ...student,
  company: '',
  designation: '',
  experience: [],
}
assert.equal(
  profileCompleteness(studentNoEmployer, { postCount: 1 }).percent,
  100,
  'a student needs no employer or work history to reach 100%',
)

// Someone exploring owes almost nothing: no projects, no certifications, no
// links, and they still finish.
const exploring: User = {
  ...base,
  employmentType: 'Just looking around',
  photo: 'data:image/jpeg;base64,x',
  city: 'Hubli',
  batchYear: 2016,
  course: 'Networking',
  roomanCenter: 'Hubli',
  bio: 'Rooman networking alum, mostly here to keep an eye on what everyone is building.',
  expertise: ['Networking', 'Linux', 'Support'],
  education: [{ degree: 'BCA', institution: 'KU', year: '2016' }],
  linkedin: 'https://linkedin.com/in/x',
}
assert.equal(
  profileCompleteness(exploring, { postCount: 1 }).percent,
  100,
  'an exploring member must be able to finish without a portfolio',
)
// And proof of work is genuinely unscored for them.
assert.equal(
  profileCompleteness({ ...exploring, projects: [], certifications: [] }, { postCount: 1 }).percent,
  100,
)

// A job-seeker IS asked for availability, and cannot reach 100% without it.
const seeking: User = {
  ...pro,
  employmentType: 'Looking for opportunity',
  company: '',
  designation: '',
  college: 'RV College',
}
assert.ok(
  profileCompleteness(seeking, { postCount: 3 }).percent < 100,
  'a job-seeker without availability details is incomplete',
)
assert.equal(
  profileCompleteness(
    { ...seeking, noticePeriod: '1 month', preferredLocations: ['Bengaluru'], workMode: 'Hybrid' },
    { postCount: 3 },
  ).percent,
  100,
)

// A verified mentor is asked what they can teach AND when they are free.
const mentorUser: User = { ...pro, isMentor: true, mentorVerified: true, willingToMentor: true }
assert.ok(
  profileCompleteness(mentorUser, { postCount: 3 }).percent < 100,
  'a mentor with no topics or availability is incomplete',
)
assert.equal(
  profileCompleteness(
    {
      ...mentorUser,
      mentorTopics: ['System design'],
      mentorAvailability: '2 hrs/week',
      mentorshipMode: 'Call',
      noticePeriod: '2 months',
      preferredLocations: ['Bengaluru'],
      workMode: 'Hybrid',
    },
    { postCount: 3 },
  ).percent,
  100,
)

// The mentoring bucket is dormant for someone who never offered to mentor, so
// they are not marked down for declining.
assert.ok(
  !profileCompleteness(pro, { postCount: 3 }).missing.some((m) => m.label.includes('mentor')),
  'a member who never opted in must not be asked for mentoring detail',
)
// But it counts as soon as a working member opts in.
assert.ok(
  profileCompleteness({ ...pro, willingToMentor: true }, { postCount: 3 }).percent < 100,
  'opting in to mentoring adds its questions',
)

// Someone exploring is asked for nothing beyond identity, bio/skills,
// education and a post — no projects, no links, no employer.
const exploringMissing = profileCompleteness(exploring, { postCount: 0 }).missing.map((m) => m.label)
assert.deepEqual(exploringMissing, ['Share your first post'])
assert.equal(profileRole(mentorUser), 'mentor', 'a verified mentor is scored as a mentor')
assert.equal(profileRole(exploring), 'exploring')
assert.equal(profileRole(student), 'student')
assert.equal(profileRole(seeking), 'seeking')
assert.equal(profileRole(pro), 'working')

// --- mentor verification -------------------------------------------------

// Postgraduate detection must accept real postgraduate degrees...
for (const degree of ['M.Tech CSE', 'MSc Physics', 'MCA', 'MBA', "Master's in Data Science", 'Ph.D']) {
  assert.ok(
    hasPostgraduateDegree({ ...base, education: [{ degree, institution: 'X', year: '2020' }] }),
    `${degree} should count as postgraduate`,
  )
}
// ...and reject undergraduate ones. "Diploma" is the important case: a missing
// word boundary in the pattern makes its "ma" match the M.A alternative.
for (const degree of ['B.E Computer Science', 'B.Tech', 'Diploma in Networking', 'BCA', 'B.Sc']) {
  assert.ok(
    !hasPostgraduateDegree({ ...base, education: [{ degree, institution: 'X', year: '2020' }] }),
    `${degree} must NOT count as postgraduate`,
  )
}

// Nothing a member can put in their OWN profile qualifies them to mentor:
// eligibility comes only from an admin-verified application.
assert.ok(!mentorEligibility(base).eligible, 'a blank profile cannot mentor')
assert.ok(
  !mentorEligibility({ ...base, experienceYears: 20 }).eligible,
  'self-declared experience must not qualify anyone',
)
assert.ok(
  !mentorEligibility({ ...base, education: [{ degree: 'M.Tech', institution: 'X', year: '2020' }] })
    .eligible,
  'a self-entered postgraduate degree must not qualify anyone',
)
assert.ok(
  !mentorEligibility({ ...base, mentorAssessmentScore: 95 }).eligible,
  'even a passing assessment needs the application approved',
)
assert.ok(
  mentorEligibility({ ...base, mentorVerified: true }).eligible,
  'admin verification is what qualifies a mentor',
)

// The requirement list still reports which claim the profile supports, so the
// application form can preselect the one most likely to be approved.
const claims = mentorEligibility({
  ...base,
  experienceYears: 3,
  education: [{ degree: 'B.E', institution: 'X', year: '2018' }],
}).requirements
assert.equal(claims.find((r) => r.key === 'experience')?.supportedByProfile, true)
assert.equal(claims.find((r) => r.key === 'postgrad')?.supportedByProfile, false)

// Listing takes verification and nothing else. A blank topics/availability
// pair makes someone harder to book, but must never hide a verified mentor —
// the members who predate this feature have exactly that shape.
const verified: User = { ...base, mentorVerified: true, isMentor: true, willingToMentor: true }
assert.ok(isBookableMentor(verified), 'a verified mentor is listed even with no topics set')
assert.ok(isBookableMentor({ ...verified, mentorTopics: ['System design'] }))
// An unverified member is never listed, even with topics filled in.
assert.ok(
  !isBookableMentor({ ...base, isMentor: true, mentorTopics: ['Anything'] }),
  'an unverified member must never be listed as a mentor',
)
// Nor is someone verified who is no longer flagged as a mentor.
assert.ok(!isBookableMentor({ ...base, mentorVerified: true }), 'isMentor is still required')

console.log(
  `ok — blank 0%, pro/student/fresher all reach 100%, no-proof ${profileCompleteness(noProof, { postCount: 3 }).percent}%, extras contribute 0`,
)
