import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

/**
 * Applies schema.sql to the configured database. Idempotent — every statement
 * uses IF NOT EXISTS, so this is safe to run on every deploy.
 * Run with: `npm run db:migrate` (dev) — points at DATABASE_URL / RDS in prod.
 */
export async function migrate(): Promise<void> {
  const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url))
  const sql = readFileSync(schemaPath, 'utf8')
  await pool.query(sql)
}

// Allow running directly as a script.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  migrate()
    .then(() => {
      console.log('✓ Migration applied')
      return pool.end()
    })
    .catch((err) => {
      console.error('✗ Migration failed:', err)
      process.exit(1)
    })
}
