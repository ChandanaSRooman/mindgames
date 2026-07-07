import './env.js' // must run before we read process.env

/**
 * Centralised, validated configuration. Everything the backend needs from the
 * environment is read here once so the rest of the code imports typed values
 * instead of touching process.env directly.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    )
  }
  return v
}

// In production a real DATABASE_URL is mandatory. In dev we fall back to the
// local Docker Postgres so the app runs out of the box.
const isProd = process.env.NODE_ENV === 'production'
const DEV_DATABASE_URL = 'postgres://roo:roo_dev_pw@localhost:5433/rooconnect'

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd,
  port: Number(process.env.PORT) || 4000,

  // Postgres (Amazon RDS in prod, local Docker in dev).
  databaseUrl: isProd ? required('DATABASE_URL') : process.env.DATABASE_URL || DEV_DATABASE_URL,
  // RDS requires TLS. Set DATABASE_SSL=true (or rely on prod default).
  databaseSsl: process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === 'true'
    : isProd,

  // Auth. JWT_SECRET must be set in prod; dev gets an obvious placeholder.
  jwtSecret: isProd ? required('JWT_SECRET') : process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Default password given to seeded demo accounts (dev convenience only).
  seedPassword: process.env.SEED_PASSWORD || 'roomandemo',

  // Google OAuth (Web) client id. When set, "Continue with Google" is real;
  // when empty, the button falls back to the simulated demo account.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
}
