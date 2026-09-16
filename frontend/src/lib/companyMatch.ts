// How well a company fits a particular member — the scoring behind the
// "Companies for you" strip and the side-by-side comparison.
//
// Sibling of lib/matching.ts, which scores person-to-person for network
// suggestions. Same idea, same output shape (a score plus the reasons behind
// it), different subject — so the two read alike and neither has to invent its
// own vocabulary.
//
// Design rules, in priority order:
//
// 1. EVERY POINT IS EXPLAINABLE. A factor that cannot state its evidence in a
//    sentence ("7 of the 12 skills common here") does not belong in the score.
//    The number is only useful if the member can argue with it.
//
// 2. THE DENOMINATOR IS DYNAMIC. A factor nobody has the data for — median
//    seniority at a company where no alumnus stated their experience — is
//    DROPPED and the remaining weights are renormalised, rather than scored
//    zero. Missing data must not read as a bad match. (Same rule as
//    profileCompleteness.ts, and for the same reason.)
//
// 3. CONFIDENCE IS SEPARATE FROM SCORE. Three alumni and a half-empty profile
//    can still produce 80%, and saying so without saying how thin the evidence
//    is would be a lie of omission. Confidence is reported alongside, never
//    baked into the number.
//
// 4. NOTHING HERE FETCHES OR RENDERS. Pure functions over data the caller
//    already has, so the rules stay readable and testable in one file
//    (see companyMatch.check.ts).

import type { CompanySignals, CompanyWithSignals, NamedFrequency, SkillFrequency, User } from '../types'

export type CompanyFactorKey =
  | 'skills'
  | 'domain'
  | 'seniority'
  | 'network'
  | 'industry'
  | 'location'
  | 'hiring'

export interface CompanyMatchFactor {
  key: CompanyFactorKey
  /** Column heading in the comparison table. */
  label: string
  /** Single word, for the icon tiles in the comparison. Never two words —
   *  the tile has room for one and truncating mid-phrase reads as a bug. */
  short: string
  /** 0-1 within this factor, or null when there is no data to judge it on. */
  ratio: number | null
  /** Points out of 100 this factor is worth before renormalisation. */
  weight: number
  /** The evidence, in words. Shown verbatim. */
  detail: string
}

export type MatchConfidence = 'low' | 'medium' | 'high'

export interface CompanyMatch {
  /** 0-100 over the factors that could be judged. */
  score: number
  confidence: MatchConfidence
  /** Why the confidence is what it is, shown as a caption. */
  confidenceNote: string
  factors: CompanyMatchFactor[]
  /** The strongest few factors, for the "why" pills on a card. */
  reasons: CompanyMatchFactor[]
}

// Weights sum to 100. Skills dominate because they are the thing a member can
// actually act on; network is weighted as highly as domain because a warm
// introduction is the part of this that a job board cannot offer.
const WEIGHTS: Record<CompanyFactorKey, number> = {
  skills: 30,
  domain: 15,
  seniority: 15,
  network: 15,
  industry: 10,
  location: 10,
  hiring: 5,
}

/** Years of seniority difference at which the fit is considered fully lost. */
const SENIORITY_TOLERANCE = 6

/** Weighted network reach at which the network factor saturates. */
const NETWORK_SATURATION = 8

const norm = (s: string) => s.trim().toLowerCase()

/** Case-insensitive membership, the way every comparison in this file means it. */
function includesNorm(haystack: string[], needle: string): boolean {
  const n = norm(needle)
  return haystack.some((h) => norm(h) === n)
}

/**
 * Everything the member can claim as a skill: the expertise tags they picked
 * plus the tech listed on their projects. Projects are included because a
 * resume upload fills them in while expertise is hand-picked, so a member who
 * uploaded a CV should not score as though they know nothing.
 */
export function memberSkills(me: User): string[] {
  const out: string[] = []
  for (const s of me.expertise ?? []) if (s.trim()) out.push(s.trim())
  for (const p of me.projects ?? []) {
    for (const t of p.tech ?? []) if (t.trim()) out.push(t.trim())
  }
  // De-duplicate case-insensitively, keeping the first spelling the member used.
  const seen = new Set<string>()
  return out.filter((s) => {
    const k = norm(s)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function skillsFactor(me: User, sig: CompanySignals): CompanyMatchFactor {
  const base = { key: 'skills' as const, label: 'Skills', short: 'Skills', weight: WEIGHTS.skills }
  const mine = memberSkills(me)
  if (!sig.topSkills.length) {
    return { ...base, ratio: null, detail: 'No alumni here have listed their skills yet' }
  }
  if (!mine.length) {
    return { ...base, ratio: 0, detail: 'Add your skills to score this' }
  }
  // Weighted by how many people hold each skill, not a flat count: matching a
  // skill 9 of 10 alumni have says more about fitting in than matching one
  // that a single person listed.
  const total = sig.topSkills.reduce((n, s) => n + s.holders, 0)
  const matched = sig.topSkills.filter((s) => includesNorm(mine, s.skill))
  const hit = matched.reduce((n, s) => n + s.holders, 0)
  return {
    ...base,
    ratio: total ? hit / total : 0,
    detail: `You have ${matched.length} of the ${sig.topSkills.length} skills common here`,
  }
}

function domainFactor(me: User, sig: CompanySignals): CompanyMatchFactor {
  const base = { key: 'domain' as const, label: 'Domain', short: 'Domain', weight: WEIGHTS.domain }
  const total = sig.domains.reduce((n, d) => n + d.count, 0)
  if (!total || !me.domain) {
    return { ...base, ratio: null, detail: 'Not enough domain data' }
  }
  const mine = sig.domains.find((d) => norm(d.domain) === norm(me.domain))?.count ?? 0
  return {
    ...base,
    ratio: mine / total,
    detail: mine
      ? `${mine} of ${total} alumni work in ${me.domain}`
      : `No ${me.domain} alumni here yet`,
  }
}

function seniorityFactor(me: User, sig: CompanySignals): CompanyMatchFactor {
  const base = { key: 'seniority' as const, label: 'Seniority', short: 'Seniority', weight: WEIGHTS.seniority }
  // Either side being unknown makes this unjudgeable, and rule 2 says an
  // unjudgeable factor leaves the denominator. Guarding the member's side too
  // is what stops a profile missing experienceYears turning the whole score
  // into NaN — which would render as "NaN" in the ring and sort unpredictably,
  // rather than failing loudly.
  if (sig.medianExperience === undefined || !Number.isFinite(sig.medianExperience)) {
    return { ...base, ratio: null, detail: 'Nobody here has stated their experience' }
  }
  if (!Number.isFinite(me.experienceYears)) {
    return { ...base, ratio: null, detail: 'Add your years of experience to score this' }
  }
  const median = sig.medianExperience
  const gap = me.experienceYears - median
  // Symmetric: being far above the typical hire is as poor a fit as being far
  // below it, just for the opposite reason.
  const ratio = Math.max(0, 1 - Math.abs(gap) / SENIORITY_TOLERANCE)
  const rounded = Math.round(median * 10) / 10
  const detail =
    Math.abs(gap) < 1
      ? `You are right at the typical ${rounded} years here`
      : gap < 0
        ? `Typically ${rounded} years here — you are ${Math.abs(Math.round(gap))} short`
        : `Typically ${rounded} years here — you are ${Math.round(gap)} ahead`
  return { ...base, ratio, detail }
}

function networkFactor(sig: CompanySignals): CompanyMatchFactor {
  const base = { key: 'network' as const, label: 'Your way in', short: 'Network', weight: WEIGHTS.network }
  // A direct connection is worth more than a stranger who ticked a box, so it
  // counts double.
  const reach = sig.connectedAlumni * 2 + sig.referralOpen + sig.mentorCount
  const parts: string[] = []
  if (sig.connectedAlumni) parts.push(`${sig.connectedAlumni} you know`)
  if (sig.referralOpen) parts.push(`${sig.referralOpen} open to referrals`)
  if (sig.mentorCount) parts.push(`${sig.mentorCount} mentoring`)
  return {
    ...base,
    ratio: Math.min(1, reach / NETWORK_SATURATION),
    detail: parts.length ? parts.join(', ') : 'No warm introductions here yet',
  }
}

function industryFactor(me: User, company: { industry: string }): CompanyMatchFactor {
  const base = { key: 'industry' as const, label: 'Industry', short: 'Industry', weight: WEIGHTS.industry }
  if (!me.industry) {
    return { ...base, ratio: null, detail: 'Set your industry to score this' }
  }
  const same = norm(me.industry) === norm(company.industry)
  return {
    ...base,
    ratio: same ? 1 : 0,
    detail: same ? `Both ${company.industry}` : `${company.industry}, you are ${me.industry}`,
  }
}

function locationFactor(me: User, sig: CompanySignals): CompanyMatchFactor {
  const base = { key: 'location' as const, label: 'Location', short: 'Location', weight: WEIGHTS.location }
  if (!sig.cities.length) {
    return { ...base, ratio: null, detail: 'No locations listed by alumni here' }
  }
  const wanted = [me.city, ...(me.preferredLocations ?? [])].filter((c) => c && c.trim())
  const hit = sig.cities.find((c) => includesNorm(wanted, c.city))
  if (hit) {
    return { ...base, ratio: 1, detail: `${hit.count} alumni in ${hit.city}` }
  }
  // Willing to move is a real, partial answer — not the same as a mismatch.
  if (me.openToRelocate) {
    return { ...base, ratio: 0.5, detail: `Mostly ${sig.cities[0].city} — you are open to relocating` }
  }
  return { ...base, ratio: 0, detail: `Mostly ${sig.cities[0].city}` }
}

function hiringFactor(me: User, sig: CompanySignals): CompanyMatchFactor {
  const base = { key: 'hiring' as const, label: 'Hiring now', short: 'Hiring', weight: WEIGHTS.hiring }
  if (!sig.hiringRoles.length) {
    return { ...base, ratio: null, detail: 'No open roles posted here' }
  }
  // Word-level overlap: "Senior Data Engineer" should match a member whose
  // designation is "Data Engineer" without needing the titles to be identical.
  const myWords = new Set(norm(me.designation ?? '').split(/\s+/).filter((w) => w.length > 2))
  const match = sig.hiringRoles.find((r) =>
    norm(r.role)
      .split(/\s+/)
      .some((w) => w.length > 2 && myWords.has(w)),
  )
  const openCount = sig.hiringRoles.reduce((n, r) => n + r.count, 0)
  return {
    ...base,
    ratio: match ? 1 : 0.4,
    detail: match
      ? `Hiring ${match.role} — close to your role`
      : `${openCount} open role${openCount > 1 ? 's' : ''} posted`,
  }
}

function confidenceOf(sig: CompanySignals, skillCount: number): {
  confidence: MatchConfidence
  confidenceNote: string
} {
  if (sig.sampleSize === 0) {
    return {
      confidence: 'low',
      confidenceNote: 'No Rooman alumni here yet — scored on industry and location alone',
    }
  }
  if (skillCount < 3) {
    return {
      confidence: 'low',
      confidenceNote: 'Add your skills or upload your resume to sharpen this',
    }
  }
  if (sig.sampleSize >= 8 && skillCount >= 5) {
    return { confidence: 'high', confidenceNote: `Based on ${sig.sampleSize} alumni here` }
  }
  return {
    confidence: 'medium',
    confidenceNote: `Based on only ${sig.sampleSize} alumni here`,
  }
}

/**
 * Scores one company against one member.
 *
 * Factors with a null ratio are excluded from BOTH the numerator and the
 * denominator, so the percentage always means "of what could be judged".
 */
export function scoreCompanyMatch(company: CompanyWithSignals, me: User): CompanyMatch {
  const sig = company.signals
  const factors: CompanyMatchFactor[] = [
    skillsFactor(me, sig),
    domainFactor(me, sig),
    seniorityFactor(me, sig),
    networkFactor(sig),
    industryFactor(me, company),
    locationFactor(me, sig),
    hiringFactor(me, sig),
  ]

  // A non-finite ratio is treated exactly like missing data. Without this one
  // bad factor would make `earned` NaN and take the whole score with it.
  const judged = factors.filter((f) => f.ratio !== null && Number.isFinite(f.ratio))
  const totalWeight = judged.reduce((n, f) => n + f.weight, 0)
  const earned = judged.reduce((n, f) => n + (f.ratio as number) * f.weight, 0)
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0

  // Strongest first, by points actually contributed — a factor worth 30 that
  // scored 0.2 is a weaker reason than one worth 10 that scored 1.
  const reasons = judged
    .filter((f) => (f.ratio as number) > 0)
    .sort((a, b) => (b.ratio as number) * b.weight - (a.ratio as number) * a.weight)
    .slice(0, 3)

  return { score, ...confidenceOf(sig, memberSkills(me).length), factors, reasons }
}

export interface RankedCompany {
  company: CompanyWithSignals
  match: CompanyMatch
}

/**
 * Ranks companies for a member, best fit first.
 *
 * Ties break on alumni count: between two equally good fits, the one with more
 * Rooman people is the more useful suggestion, because everything this feature
 * is actually for — roadmaps, referrals, someone to ask — scales with that.
 */
export function rankCompanies(companies: CompanyWithSignals[], me: User): RankedCompany[] {
  return companies
    .map((company) => ({ company, match: scoreCompanyMatch(company, me) }))
    .sort((a, b) => b.match.score - a.match.score || b.company.alumniCount - a.company.alumniCount)
}

/**
 * The verdict line for a comparison: which of the chosen companies fits best,
 * and the single factor that separates it from the runner-up.
 *
 * Returns null for fewer than two companies — there is no comparison to make,
 * and inventing a verdict from one option would be noise.
 */
export function compareVerdict(ranked: RankedCompany[]): { winner: RankedCompany; because: string } | null {
  if (ranked.length < 2) return null
  const [winner, runnerUp] = ranked
  // The factor where the winner's lead over the runner-up is widest, measured
  // in points rather than ratio so weighting is respected.
  let best: CompanyMatchFactor | null = null
  let bestLead = -Infinity
  for (const f of winner.match.factors) {
    if (f.ratio === null) continue
    const other = runnerUp.match.factors.find((o) => o.key === f.key)
    const otherRatio = other?.ratio ?? 0
    const lead = (f.ratio - otherRatio) * f.weight
    if (lead > bestLead) {
      bestLead = lead
      best = f
    }
  }
  const because =
    best && bestLead > 0
      ? `${best.label.toLowerCase()}: ${best.detail.toLowerCase()}`
      : 'the strongest overall fit across every factor'
  return { winner, because }
}

// ---------------------------------------------------------------------------
// The gap: what this company's people have that the member does not.
//
// Same inputs as the skills factor above, deliberately — so the checklist can
// never tell you to learn something the score did not already count against
// you. `have` is returned alongside `missing` because a list of only failures
// reads as a rejection; showing what already lines up is what makes it a
// roadmap rather than a scorecard.
// ---------------------------------------------------------------------------
export interface CompanyGap {
  have: SkillFrequency[]
  missing: SkillFrequency[]
  /** Certifications held by alumni here that the member does not have. */
  missingCertifications: NamedFrequency[]
}

export function companyGap(me: User, sig: CompanySignals): CompanyGap {
  const mine = memberSkills(me)
  const myCerts = (me.certifications ?? []).map((c) => c.name).filter(Boolean)
  return {
    have: sig.topSkills.filter((s) => includesNorm(mine, s.skill)),
    missing: sig.topSkills.filter((s) => !includesNorm(mine, s.skill)),
    missingCertifications: sig.topCertifications.filter((c) => !includesNorm(myCerts, c.name)),
  }
}

/**
 * Mentors at this company whose topics cover one of the member's gaps.
 *
 * Matched on whole words so "System design" covers a "system design" gap
 * without requiring the two strings to be identical. Returns the gap skills
 * that are covered, not the mentors themselves — the caller already has the
 * roadmap list and can match names to it.
 */
export function gapsCoveredByTopics(gap: CompanyGap, topics: string[]): string[] {
  const topicWords = new Set(
    topics.flatMap((t) => norm(t).split(/[\s,/]+/)).filter((w) => w.length > 2),
  )
  return gap.missing
    .map((s) => s.skill)
    .filter((skill) =>
      norm(skill)
        .split(/[\s,/]+/)
        .some((w) => w.length > 2 && topicWords.has(w)),
    )
}

/**
 * Whether a company can be scored at all.
 *
 * With no alumni and no open roles, almost every factor is unjudgeable and the
 * score collapses onto whichever one or two can still be answered — a company
 * nobody has ever worked at can land near 40% purely because its industry
 * matches yours. That number looks like a finding and is built on nothing.
 *
 * Rule 3 says confidence is reported, never baked into the score; this is the
 * one case that rule cannot cover, because the problem is not low confidence
 * but no evidence whatsoever. Such companies are excluded from "for you"
 * entirely — they are still in the directory below it, where they belong.
 */
export function hasMatchEvidence(company: CompanyWithSignals): boolean {
  const s = company.signals
  return s.sampleSize > 0 || s.hiringRoles.length > 0
}
