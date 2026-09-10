import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'

const ROUNDS = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// Charset excludes visually ambiguous characters (0/O, 1/l/I) since this is
// read off an email and typed by hand — a password nobody can transcribe
// correctly isn't more secure, just more support tickets.
const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/** A random 12-character password for admin-generated (invited) accounts. */
export function generatePassword(length = 12): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[randomInt(0, PASSWORD_CHARS.length)]
  }
  return out
}
