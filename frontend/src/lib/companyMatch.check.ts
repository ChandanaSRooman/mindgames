// Sanity checks for company match scoring. Run with:
//   npm --prefix frontend run check
import assert from 'node:assert'
import {
  companyGap,
  compareVerdict,
  gapsCoveredByTopics,
  hasMatchEvidence,
  memberSkills,
  rankCompanies,
  scoreCompanyMatch,
} from './companyMatch'
import type { CompanySignals, CompanyWithSignals, User } from '../types'

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

const emptySignals: CompanySignals = {
  topSkills: [],
  topCertifications: [],
  cities: [],
  domains: [],
  hiringRoles: [],
  medianExperience: undefined,
  referralOpen: 0,
  mentorCount: 0,
  roadmapCount: 0,
  connectedAlumni: 0,
  sampleSize: 0,
}

function company(name: string, signals: Partial<CompanySignals>, industry = 'Product / SaaS'): CompanyWithSignals {
  return {
    id: name.toLowerCase(),
    name,
    industry,
    alumniCount: signals.sampleSize ?? 0,
    previewAlumni: [],
    savedByMe: false,
    signals: { ...emptySignals, ...signals },
  }
}

// --- skills come from expertise AND projects -------------------------------

assert.deepEqual(memberSkills(base), [])
assert.deepEqual(
  memberSkills({ ...base, expertise: ['React'], projects: [{ title: 'x', description: '', tech: ['Node.js'] }] }),
  ['React', 'Node.js'],
  'project tech must count as skills — a resume upload fills those in, not expertise',
)
assert.deepEqual(
  memberSkills({ ...base, expertise: ['React'], projects: [{ title: 'x', description: '', tech: ['react'] }] }),
  ['React'],
  'the same skill in two places must not be counted twice',
)

// --- rule 2: an unknowable factor is dropped, never scored zero -------------

// A company nobody has data for: every factor is null except industry (which
// the member has not set either) and network, which is legitimately zero.
const unknown = company('Unknown Co', {})
const unknownMatch = scoreCompanyMatch(unknown, base)
assert.ok(
  unknownMatch.factors.filter((f) => f.ratio === null).length >= 4,
  'factors with no data must report a null ratio',
)
assert.equal(unknownMatch.confidence, 'low')

// The decisive check for rule 2: a perfect member scores the SAME whether or
// not the company happens to have seniority data, because a missing factor
// leaves the denominator instead of dragging the score down.
const perfect: User = {
  ...base,
  expertise: ['React', 'Node.js'],
  domain: 'Web Dev',
  industry: 'Product / SaaS',
  city: 'Bengaluru',
  experienceYears: 5,
  designation: 'Software Engineer',
}
const richSignals: Partial<CompanySignals> = {
  topSkills: [
    { skill: 'React', holders: 5 },
    { skill: 'Node.js', holders: 5 },
  ],
  domains: [{ domain: 'Web Dev', count: 10 }],
  cities: [{ city: 'Bengaluru', count: 10 }],
  connectedAlumni: 4,
  referralOpen: 2,
  sampleSize: 10,
  hiringRoles: [{ role: 'Software Engineer', count: 1 }],
}
const withSeniority = scoreCompanyMatch(company('A', { ...richSignals, medianExperience: 5 }), perfect)
const withoutSeniority = scoreCompanyMatch(company('A', richSignals), perfect)
assert.equal(withSeniority.score, 100, 'a perfect match on every judged factor must reach 100')
assert.equal(
  withoutSeniority.score,
  withSeniority.score,
  'a missing factor must not lower the score — it leaves the denominator',
)

// --- skills are weighted by how many people hold them -----------------------

const widelyHeld = scoreCompanyMatch(
  company('B', {
    topSkills: [
      { skill: 'React', holders: 9 },
      { skill: 'COBOL', holders: 1 },
    ],
    sampleSize: 10,
  }),
  { ...base, expertise: ['React'] },
)
const rarelyHeld = scoreCompanyMatch(
  company('B', {
    topSkills: [
      { skill: 'React', holders: 9 },
      { skill: 'COBOL', holders: 1 },
    ],
    sampleSize: 10,
  }),
  { ...base, expertise: ['COBOL'] },
)
assert.ok(
  widelyHeld.score > rarelyHeld.score,
  'matching the skill 9 of 10 alumni hold must beat matching the one only 1 holds',
)

// --- seniority is symmetric ------------------------------------------------

const mid = { ...base, expertise: ['React'] }
const under = scoreCompanyMatch(company('C', { medianExperience: 6, sampleSize: 5 }), { ...mid, experienceYears: 3 })
const over = scoreCompanyMatch(company('C', { medianExperience: 6, sampleSize: 5 }), { ...mid, experienceYears: 9 })
assert.equal(under.score, over.score, 'being 3 years over must score the same as 3 years under')

// --- relocating is a partial answer, not a mismatch ------------------------

const stuck = scoreCompanyMatch(company('D', { cities: [{ city: 'Pune', count: 4 }], sampleSize: 4 }), {
  ...base,
  city: 'Bengaluru',
})
const mobile = scoreCompanyMatch(company('D', { cities: [{ city: 'Pune', count: 4 }], sampleSize: 4 }), {
  ...base,
  city: 'Bengaluru',
  openToRelocate: true,
})
assert.ok(mobile.score > stuck.score, 'open to relocating must score above a flat location mismatch')

// --- confidence is separate from score -------------------------------------

const thin = scoreCompanyMatch(
  company('E', {
    topSkills: [{ skill: 'React', holders: 2 }],
    domains: [{ domain: 'Web Dev', count: 2 }],
    sampleSize: 2,
  }),
  { ...base, expertise: ['React', 'Node.js', 'AWS'] },
)
assert.ok(thin.score > 0, 'a thin sample can still score well')
assert.equal(thin.confidence, 'medium', 'but it must not claim high confidence')
assert.ok(thin.confidenceNote.includes('2'), 'the note must say how thin the evidence is')

// --- ranking and the comparison verdict ------------------------------------

const strong = company('Strong', { ...richSignals, medianExperience: 5, sampleSize: 12 })
const weak = company('Weak', { sampleSize: 0 }, 'Telecom')
const ranked = rankCompanies([weak, strong], perfect)
assert.equal(ranked[0].company.name, 'Strong', 'best fit must rank first')

const verdict = compareVerdict(ranked)
assert.ok(verdict, 'two companies must produce a verdict')
assert.equal(verdict.winner.company.name, 'Strong')
assert.ok(verdict.because.length > 0, 'the verdict must say what separated them')
assert.equal(compareVerdict(ranked.slice(0, 1)), null, 'one company is not a comparison')

// --- a member with no skills is told so, not silently zeroed ---------------

const noSkills = scoreCompanyMatch(company('F', { topSkills: [{ skill: 'React', holders: 3 }], sampleSize: 3 }), base)
const skillsFactor = noSkills.factors.find((f) => f.key === 'skills')
assert.equal(skillsFactor?.ratio, 0)
assert.match(skillsFactor?.detail ?? '', /Add your skills/)

// --- the gap must agree with the score ------------------------------------

const gapSignals: CompanySignals = {
  ...emptySignals,
  topSkills: [
    { skill: 'React', holders: 5 },
    { skill: 'Kubernetes', holders: 4 },
  ],
  topCertifications: [{ name: 'AWS Solutions Architect', holders: 3 }],
  sampleSize: 5,
}
const learner: User = {
  ...base,
  expertise: ['react'],
  certifications: [{ name: 'aws solutions architect', issuer: 'AWS', year: '2022' }],
}
const gap = companyGap(learner, gapSignals)
assert.deepEqual(gap.have.map((s) => s.skill), ['React'], 'matching is case-insensitive')
assert.deepEqual(gap.missing.map((s) => s.skill), ['Kubernetes'])
assert.deepEqual(
  gap.missingCertifications,
  [],
  'a certification the member already holds must not be listed as missing',
)

// The checklist must never ask for something the score did not count against
// you: every "missing" skill has to be one the skills factor failed to match.
const scored = scoreCompanyMatch(company('G', gapSignals), learner)
const skillsDetail = scored.factors.find((f) => f.key === 'skills')?.detail ?? ''
assert.equal(skillsDetail, 'You have 1 of the 2 skills common here')
assert.equal(gap.have.length, 1, 'the gap and the score must count the same matches')

// A mentor whose topic covers a gap is surfaced against that exact skill.
assert.deepEqual(gapsCoveredByTopics(gap, ['Kubernetes and cloud native']), ['Kubernetes'])
assert.deepEqual(gapsCoveredByTopics(gap, ['Public speaking']), [])

// --- a score can never be NaN ---------------------------------------------

// A member whose experienceYears is missing (a hand-built object, an older
// cached profile) must drop the seniority factor, not poison the whole score.
const noYears = scoreCompanyMatch(
  company('H', { ...richSignals, medianExperience: 5 }),
  { ...perfect, experienceYears: undefined as unknown as number },
)
assert.ok(Number.isFinite(noYears.score), 'score must never be NaN')
assert.equal(noYears.score, 100, 'dropping the unjudgeable factor leaves a perfect match perfect')
assert.equal(
  noYears.factors.find((f) => f.key === 'seniority')?.ratio,
  null,
  'an unknown member seniority must be null, not a number',
)

// --- a company with no evidence is not "for you" ---------------------------

// The exact trap: zero alumni, but the industry matches, so the only judgeable
// factors are industry (perfect) and network (zero). That yields a confident
// looking number about a company nobody here has ever worked at.
const hollow = company('Hollow', { sampleSize: 0 }, 'Product / SaaS')
const hollowMatch = scoreCompanyMatch(hollow, perfect)
assert.ok(hollowMatch.score > 0, 'the misleading score is real — this is what we are guarding against')
assert.equal(hasMatchEvidence(hollow), false, 'no alumni and no open roles means nothing to score')

// An open role is evidence even with no alumni: somebody is actually hiring.
assert.equal(
  hasMatchEvidence(company('Hiring Co', { sampleSize: 0, hiringRoles: [{ role: 'SDE', count: 1 }] })),
  true,
  'an open role is enough to be worth showing',
)
assert.equal(hasMatchEvidence(company('Real', { sampleSize: 3 })), true)

console.log('companyMatch.check.ts — all assertions passed')
