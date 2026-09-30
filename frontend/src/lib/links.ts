/**
 * Whether a link will pass the server's check: a well-formed http(s) URL.
 * Mirrors backend/src/validation.ts (isHttpUrl). Checking it here first keeps
 * a form open with the user's input instead of losing it to a rejected save.
 */
export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const u = new URL(value)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0
  } catch {
    return false
  }
}
