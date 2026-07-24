import type { User } from '../types'

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
export function rankByMatch<T extends User>(candidates: T[], me: User): T[] {
  return [...candidates].sort((a, b) => scoreMatch(b, me).score - scoreMatch(a, me).score)
}
