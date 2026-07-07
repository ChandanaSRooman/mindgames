import { fileURLToPath } from 'node:url'
import { pool, withTransaction } from './pool.js'
import { migrate } from './migrate.js'
import { hashPassword } from '../auth/password.js'
import { config } from '../config.js'
import {
  seedCommunities,
  seedConnections,
  seedConversations,
  seedInvitees,
  seedLikes,
  seedMentorApplications,
  seedNotifications,
  seedPosts,
  seedSaves,
  seedSessions,
  seedStartups,
  seedUsers,
} from './seed-data.js'

const ME = 'me'

/**
 * Resets the database to the demo seed: TRUNCATES everything and re-inserts.
 * Seeded accounts share SEED_PASSWORD (default "roomandemo") for dev login.
 *
 * DESTRUCTIVE GUARD: if any real (non-seed) account exists — i.e. someone has
 * signed up — the reset aborts unless run with --force (or FORCE_SEED=1), so a
 * casual re-seed can never wipe real users.
 */
export async function seed(opts: { force?: boolean } = {}): Promise<void> {
  await migrate()

  const seedEmails = [
    ...seedUsers.map((u) => u.email.toLowerCase()),
    // Deterministic demo accounts created by the simulated social buttons.
    'google.user@rooman.alumni',
    'linkedin.user@rooman.alumni',
  ]
  const real = await pool.query<{ count: string }>(
    `SELECT count(*) FROM users WHERE lower(email) <> ALL($1)`,
    [seedEmails],
  )
  const realAccounts = Number(real.rows[0].count)
  if (realAccounts > 0 && !opts.force) {
    throw new Error(
      `Refusing to reset: ${realAccounts} real (non-seed) account(s) exist and would be DELETED. ` +
        `Re-run with --force (npm run db:seed -- --force) if you really want to wipe everything.`,
    )
  }

  const passwordHash = await hashPassword(config.seedPassword)
  // The console admin gets its own password (ADMIN_PASSWORD in .env).
  const adminHash = await hashPassword(process.env.ADMIN_PASSWORD || config.seedPassword)

  await withTransaction(async (client) => {
    await client.query(
      `TRUNCATE users, posts, comments, post_likes, post_saves, connections, invitees,
        conversations, messages, conversation_reads,
        communities, community_members, mentorship_sessions, mentor_applications,
        startups, notifications CASCADE`,
    )

    for (const u of seedUsers) {
      await client.query(
        `INSERT INTO users (
           id, name, email, phone, password_hash, is_admin, avatar, batch_year, course,
           company, designation, experience_years, domain, employment_type, city, bio,
           linkedin, expertise, willing_to_mentor, interested_in_startup, connections_count,
           is_mentor, mentor_rate, sessions_conducted
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
         )`,
        [
          u.id, u.name, u.email, u.phone ?? null,
          u.hasPassword ? (u.id === 'admin' ? adminHash : passwordHash) : null,
          u.is_admin ?? false, u.avatar, u.batch_year, u.course, u.company, u.designation,
          u.experience_years, u.domain, u.employment_type, u.city, u.bio, u.linkedin ?? null,
          u.expertise, u.willing_to_mentor, u.interested_in_startup, u.connections_count,
          u.is_mentor, u.mentor_rate ?? null, u.sessions_conducted ?? null,
        ],
      )
    }

    for (const p of seedPosts) {
      await client.query(
        `INSERT INTO posts (
           id, author_id, type, content, visibility, community_id, domain, city, batch,
           role, company, pinned, likes, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          p.id, p.author_id, p.type, p.content, p.visibility, p.community_id ?? null,
          p.domain ?? null, p.city ?? null, p.batch ?? null, p.role ?? null,
          p.company ?? null, p.pinned ?? false, p.likes, p.created_at,
        ],
      )
      for (const c of p.comments) {
        await client.query(
          `INSERT INTO comments (id, post_id, author_id, text, created_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [c.id, p.id, c.author_id, c.text, c.created_at],
        )
      }
    }

    for (const l of seedLikes) {
      await client.query(
        `INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [l.post_id, l.user_id],
      )
    }
    for (const s of seedSaves) {
      await client.query(
        `INSERT INTO post_saves (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [s.post_id, s.user_id],
      )
    }

    for (const c of seedConnections) {
      await client.query(
        `INSERT INTO connections (requester_id, addressee_id, status) VALUES ($1,$2,$3)`,
        [c.requester_id, c.addressee_id, c.status],
      )
    }

    for (const inv of seedInvitees) {
      await client.query(
        `INSERT INTO invitees (id, name, phone, email, role, batch_year, status_tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [inv.id, inv.name, inv.phone, inv.email, inv.role, inv.batch_year, inv.status_tags],
      )
    }

    for (const conv of seedConversations) {
      // Canonical pair ordering so (user_lo < user_hi) holds.
      const [lo, hi] = [ME, conv.withUserId].sort()
      await client.query(
        `INSERT INTO conversations (id, user_lo, user_hi) VALUES ($1, $2, $3)`,
        [conv.id, lo, hi],
      )
      for (const m of conv.messages) {
        await client.query(
          `INSERT INTO messages (id, conversation_id, sender_id, body, created_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [m.id, conv.id, m.from, m.body, m.created_at],
        )
      }
      if (conv.meReadAt) {
        await client.query(
          `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
           VALUES ($1, $2, $3)`,
          [conv.id, ME, conv.meReadAt],
        )
      }
    }

    for (const c of seedCommunities) {
      await client.query(
        `INSERT INTO communities (id, name, description, category, tag, color, member_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [c.id, c.name, c.description, c.category, c.tag, c.color, c.member_count],
      )
      if (c.meJoined) {
        await client.query(
          `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)`,
          [c.id, ME],
        )
      }
    }

    for (const s of seedSessions) {
      await client.query(
        `INSERT INTO mentorship_sessions (id, mentor_id, mentee_id, topic, date_label, time_label, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [s.id, s.mentor_id, s.mentee_id, s.topic, s.date_label, s.time_label, s.status],
      )
    }

    for (const uid of seedMentorApplications) {
      await client.query(`INSERT INTO mentor_applications (user_id) VALUES ($1)`, [uid])
    }

    for (const st of seedStartups) {
      await client.query(
        `INSERT INTO startups (id, founder_id, name, domain, stage, team_size, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [st.id, st.founder_id, st.name, st.domain, st.stage, st.team_size, st.description],
      )
    }

    for (const n of seedNotifications) {
      await client.query(
        `INSERT INTO notifications (id, user_id, type, text, actor_id, read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [n.id, n.user_id, n.type, n.text, n.actor_id ?? null, n.read, n.created_at],
      )
    }
  })
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const force = process.argv.includes('--force') || process.env.FORCE_SEED === '1'
  seed({ force })
    .then(() => {
      console.log(
        `✓ Seeded ${seedUsers.length} users, ${seedPosts.length} posts, ${seedInvitees.length} invitees. ` +
          `Demo login password: "${config.seedPassword}" (e.g. you@rooman.alumni).`,
      )
      return pool.end()
    })
    .catch((err) => {
      console.error('✗ Seed failed:', err)
      process.exit(1)
    })
}
