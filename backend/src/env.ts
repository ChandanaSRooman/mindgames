import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load the shared root .env first, then any backend-local .env override.
// Must be imported before modules that read process.env at load time (ai, email).
config({ path: resolve(process.cwd(), '../.env') })
config({ path: resolve(process.cwd(), '.env') })
