import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load the shared root .env first, then any backend-local .env override.
// Must be imported before modules that read process.env at load time (ai, email).
//
// dotenv never throws: it catches read failures and hands them back on the
// result, which nothing used to look at. So "the file is not there" and "the
// file is there and I was refused" arrived identically, as silence — and a
// deploy that made .env root-owned 0600 while the service runs unprivileged
// booted with an empty environment, then failed against the DEV Postgres
// default with a port that does not exist in production. Report the second
// case; a missing file is genuinely normal (dev has no ../.env).
function load(path: string): void {
  const { error } = config({ path })
  if (error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error(`Could not read ${path}: ${error.message}`)
  }
}

load(resolve(process.cwd(), '../.env'))
load(resolve(process.cwd(), '.env'))
