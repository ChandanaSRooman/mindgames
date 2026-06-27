import type { ContactRow } from '../types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Split a single CSV line, honoring double-quoted fields that contain commas.
// ponytail: single-line records only — no embedded newlines inside quotes.
// Upgrade path: replace this whole file with `papaparse`.
function splitLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"' // escaped quote
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

// Match a header cell to one of the three fields we keep.
function classifyHeader(h: string): 'name' | 'phone' | 'email' | null {
  const k = h.toLowerCase().replace(/[^a-z]/g, '')
  if (k.includes('email') || k.includes('mail')) return 'email'
  if (k.includes('phone') || k.includes('mobile') || k.includes('contact') || k.includes('number')) return 'phone'
  if (k.includes('name')) return 'name'
  return null
}

/**
 * Parse CSV text, extracting ONLY name / phone / email columns (any order).
 * Every data row is returned; `valid` flags rows missing a name/email or with
 * a malformed email so the UI can surface them rather than silently dropping.
 */
export function parseContactsCsv(text: string): ContactRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  const headers = splitLine(lines[0])
  const colIndex: { name: number; phone: number; email: number } = { name: -1, phone: -1, email: -1 }
  headers.forEach((h, i) => {
    const kind = classifyHeader(h)
    if (kind && colIndex[kind] === -1) colIndex[kind] = i
  })

  // No recognizable headers => treat as headerless name,phone,email.
  const hasHeaderRow = colIndex.name !== -1 || colIndex.email !== -1 || colIndex.phone !== -1
  const idx = hasHeaderRow ? colIndex : { name: 0, phone: 1, email: 2 }
  const dataLines = hasHeaderRow ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const cells = splitLine(line)
    const name = idx.name >= 0 ? (cells[idx.name] ?? '') : ''
    const phone = idx.phone >= 0 ? (cells[idx.phone] ?? '') : ''
    const email = idx.email >= 0 ? (cells[idx.email] ?? '') : ''
    const valid = name.length > 0 && EMAIL_RE.test(email)
    return { name, phone, email, valid }
  })
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}
