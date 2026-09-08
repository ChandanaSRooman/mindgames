// Sanity checks for the required-field rules. Run with:
//   npm --prefix frontend run check
import assert from 'node:assert'
import { missingRequired, type RequiredCheckInput } from './profileRequired'

const complete: RequiredCheckInput = {
  name: 'Asha R',
  email: 'asha@example.com',
  phone: '+91 99000 11222',
  batchYear: '2019',
  course: 'Full-Stack Dev',
  employmentType: 'Employed',
  domain: 'Web Dev',
  company: 'Acme',
  designation: 'SDE II',
  college: '',
  experienceYears: '4',
  city: 'Bengaluru',
  photo: 'data:image/jpeg;base64,x',
  linkedin: 'https://linkedin.com/in/asha',
  bio: 'Backend engineer who likes databases and mentoring juniors on system design.',
  expertise: 'Node.js, Postgres, AWS',
  interests: ['Cycling'],
  achievements: [{ title: 'Top of cohort', year: '2018' }],
  willingToMentor: false,
  mentorTopics: [],
  mentorAvailability: '',
  mentorshipMode: '',
  seekingMentorshipIn: [],
  interestedInStartup: false,
  startupIntent: '',
  startupLookingFor: [],
}

const labels = (v: RequiredCheckInput) => missingRequired(v).map((m) => m.label)

// A fully filled working professional is done.
assert.deepEqual(labels(complete), [])

// Every basic field is genuinely mandatory.
for (const [field, blanked] of [
  ['name', { name: '' }],
  ['phone', { phone: '' }],
  ['batchYear', { batchYear: '' }],
  ['course', { course: '' }],
  ['city', { city: '' }],
  ['photo', { photo: undefined }],
  ['linkedin', { linkedin: '' }],
  ['domain', { domain: '' }],
  ['interests', { interests: [] }],
  ['achievements', { achievements: [] }],
] as const) {
  assert.equal(
    labels({ ...complete, ...(blanked as object) }).length,
    1,
    `blanking ${field} should leave exactly one thing outstanding`,
  )
}

// A 4-digit year is required, not just any text.
assert.equal(labels({ ...complete, batchYear: '19' }).length, 1)

// Bio and skills have real thresholds, not just "non-empty".
assert.equal(labels({ ...complete, bio: 'Hi there.' }).length, 1, 'a 9-char bio is not enough')
assert.equal(labels({ ...complete, expertise: 'Node.js, AWS' }).length, 1, '2 skills is not enough')

// --- status adapts: nobody is asked for a field that cannot apply ---------

// A student is asked for their college, never an employer.
const student: RequiredCheckInput = {
  ...complete,
  employmentType: 'Student',
  company: '',
  designation: '',
  experienceYears: '',
  college: 'RV College',
}
assert.deepEqual(labels(student), [], 'a student with a college is complete')
assert.deepEqual(labels({ ...student, college: '' }), ['Your college or institution'])

// Someone job-hunting is asked for experience but no employer.
const looking: RequiredCheckInput = {
  ...complete,
  employmentType: 'Looking for opportunity',
  company: '',
  designation: '',
  college: '',
}
assert.deepEqual(labels(looking), [], 'job-hunting needs no employer')
assert.deepEqual(labels({ ...looking, experienceYears: '' }), ['Your years of experience'])

// "Just looking around" is asked for nothing beyond the status.
const browsing: RequiredCheckInput = {
  ...complete,
  employmentType: 'Just looking around',
  company: '',
  designation: '',
  college: '',
  experienceYears: '',
}
assert.deepEqual(labels(browsing), [], 'browsing members owe nothing extra')

// A working professional IS asked for all three.
assert.deepEqual(
  labels({ ...complete, company: '', designation: '', experienceYears: '' }).sort(),
  ['Your current company', 'Your designation', 'Your years of experience'],
)

// --- opt-in blocks only apply once switched on ---------------------------

assert.deepEqual(labels({ ...complete, willingToMentor: false }), [], 'mentor block is dormant')
assert.deepEqual(
  labels({ ...complete, willingToMentor: true }).sort(),
  [
    'How much time you have for mentoring',
    'How you prefer to mentor',
    'The topics you can mentor on',
    'What you want mentorship in',
  ],
)
assert.deepEqual(
  labels({
    ...complete,
    willingToMentor: true,
    mentorTopics: ['System design'],
    mentorAvailability: '2 hrs/week',
    mentorshipMode: 'Call',
    seekingMentorshipIn: ['Leadership'],
  }),
  [],
)

assert.deepEqual(labels({ ...complete, interestedInStartup: false }), [], 'startup block is dormant')
assert.deepEqual(
  labels({ ...complete, interestedInStartup: true }).sort(),
  ['What you are looking for', 'Where you are with your startup idea'],
)

// --- what is deliberately NOT required ------------------------------------
// Heavily scored, but never blocking: a fresher must be able to join.
assert.deepEqual(labels(complete), [], 'education/projects/certifications are not required')

console.log('ok — required-field rules hold across all four statuses and both opt-in blocks')
