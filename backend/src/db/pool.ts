import pg from 'pg'
import { config } from '../config.js'

const { Pool } = pg

/**
 * A single shared connection pool for the whole process. Amazon RDS terminates
 * TLS, so we enable SSL (rejectUnauthorized:false accepts the RDS CA without
 * bundling it — fine for app→RDS inside a VPC).
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err)
})

/** Thin typed helper around pool.query. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never)
}

/** Run a set of statements inside a single transaction. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
