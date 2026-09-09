import type { User } from '../types'
import { profileCompleteness } from './profileCompleteness'

// Why a candidate matched — surfaced later as "why you matched" pills.
export interface MatchReason {
  type: 'domain' | 'batch' | 'location' | 'skills'
  label: string
}

export interface MatchResult {
  score: number
  reasons: MatchReason[]
}

const DOMAIN_POINTS = 25
const BATCH_EXACT_POINTS = 25
const BATCH_NEARBY_POINTS = 12
const BATCH_NEARBY_YEARS = 2
const LOCATION_POINTS = 20
const SKILL_POINTS = 10
const SKILL_MATCH_CAP = 3

// Scores how well `candidate` matches `me` for network suggestions, by
// shared domain, batch year proximity, location, and technical skills.
// Max score is 100 (25 + 25 + 20 + 30).
export function scoreMatch(candidate: User, me: User): MatchResult {
  let score = 0
  const reasons: MatchReason[] = []

  if (candidate.domain === me.domain) {
    score += DOMAIN_POINTS
    reasons.push({ type: 'domain', label: candidate.domain })
  }

  const batchDiff = Math.abs(candidate.batchYear - me.batchYear)
  if (batchDiff === 0) {
    score += BATCH_EXACT_POINTS
    reasons.push({ type: 'batch', label: `Batch ${candidate.batchYear}` })
  } else if (batchDiff <= BATCH_NEARBY_YEARS) {
    score += BATCH_NEARBY_POINTS
    reasons.push({ type: 'batch', label: `Batch ${candidate.batchYear}` })
  }

  if (candidate.city && me.city && candidate.city.toLowerCase() === me.city.toLowerCase()) {
    score += LOCATION_POINTS
    reasons.push({ type: 'location', label: candidate.city })
  }

  const sharedSkills = candidate.expertise.filter((skill) =>
    me.expertise.some((mine) => mine.toLowerCase() === skill.toLowerCase()),
  )
  if (sharedSkills.length > 0) {
    score += Math.min(sharedSkills.length, SKILL_MATCH_CAP) * SKILL_POINTS
    reasons.push({ type: 'skills', label: sharedSkills.slice(0, SKILL_MATCH_CAP).join(', ') })
  }

  return { score, reasons }
}

// Ranks candidates by match score against `me`, highest first. Stable for
// ties (Array.prototype.sort is stable in modern JS engines).
//
// Profile completeness breaks ties rather than contributing to the match score:
// how complete someone's profile is says nothing about how well they match you,
// but between two equally good matches the one you can actually learn something
// about is the more useful suggestion. This is the "ranks higher in
// suggestions" effect the completeness meter promises.
export function rankByMatch<T extends User>(candidates: T[], me: User): T[] {
  // Both scores are computed once per candidate up front rather than inside the
  // comparator, which would recompute them O(n log n) times for the same person.
  const ranked = candidates.map((u) => ({
    u,
    score: scoreMatch(u, me).score,
    completeness: profileCompleteness(u).percent,
  }))
  ranked.sort((a, b) => b.score - a.score || b.completeness - a.completeness)
  return ranked.map((r) => r.u)
}
