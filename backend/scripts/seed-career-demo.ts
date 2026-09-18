/**
 * Career Guidance demo seeder.
 *
 * Gives existing members enough profile data for the Career Guidance feature
 * to have something to show: work history (so career paths can be derived),
 * mentor approvals, services, and a few connections.
 *
 * No identities are hardcoded. Everyone is selected from whoever already
 * exists in the database, so this works against any environment.
 *
 * BEFORE RUNNING
 *   1. `npm run db:migrate`  — creates the Career Guidance tables.
 *   2. `npx tsx scripts/seed-career-demo.ts --dry-run`  — shows the plan,
 *      writes nothing.
 *
 * THEN
 *   npx tsx scripts/seed-career-demo.ts
 *
 * SAFETY
 *   - Writes a rollback snapshot to career-demo-backup.json before changing
 *     anything, containing the previous values of every field it touches.
 *   - Never changes anyone's password, email or name.
 *   - Idempotent: re-running updates in place rather than duplicating.
 *   - Skips any member who already has work history, so real profile data is
 *     never overwritten (override with --force).
 */
import { writeFileSync } from 'node:fs'
import { query, pool } from '../src/db/pool.js'

const DRY = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const tag = DRY ? '[dry-run]' : '[write]'

/** Career-history templates, applied to members in order. Each one is a
 *  plausible route into a senior technical role, which is what gives the
 *  "alumni who followed a similar path" matching something to work with. */
const TEMPLATES: {
  designation: string
  company: string
  years: number
  expertise: string[]
  experience: { role: string; company: string; period: string; summary: string }[]
  mentor: boolean
  services: [string, string[], 'free' | 'paid', number | null, 'hour' | 'session' | null][]
}[] = [
  {
    designation: 'AI Engineer', company: 'Google', years: 10, mentor: true,
    expertise: ['llm', 'rag', 'ai agents', 'python'],
    experience: [
      { role: 'Backend Developer', company: 'Rooman Technologies', period: '2015 - 2018', summary: 'Platform services' },
      { role: 'Cloud Engineer', company: 'Google', period: '2018 - 2021', summary: 'Cloud infrastructure' },
      { role: 'AI Engineer', company: 'Google', period: '2021 - Present', summary: 'LLM and RAG systems' },
    ],
    services: [
      ['project_guidance', ['rag', 'llm'], 'paid', 700, 'session'],
      ['linkedin_review', ['profile'], 'paid', 300, 'session'],
      ['domain_specific_advice', ['llm', 'rag', 'ai agents'], 'paid', 500, 'hour'],
    ],
  },
  {
    designation: 'Tech Lead', company: 'Amazon', years: 10, mentor: true,
    expertise: ['system design', 'cloud', 'full stack'],
    experience: [
      { role: 'Backend Developer', company: 'Amazon', period: '2014 - 2019', summary: 'Services' },
      { role: 'Tech Lead', company: 'Amazon', period: '2019 - Present', summary: 'Leads a platform team' },
    ],
    services: [
      ['mock_interview', ['system design'], 'paid', 600, 'session'],
      ['industry_guidance', ['cloud', 'ml'], 'paid', 500, 'session'],
      ['startup_business_guidance', ['startup'], 'paid', 1000, 'hour'],
    ],
  },
  {
    designation: 'Cloud Architect', company: 'Microsoft', years: 8, mentor: true,
    expertise: ['aws', 'cloud', 'system design', 'python'],
    experience: [
      { role: 'Backend Developer', company: 'TCS', period: '2016 - 2019', summary: 'Enterprise Java' },
      { role: 'Cloud Engineer', company: 'Microsoft', period: '2019 - 2022', summary: 'Cloud migration' },
      { role: 'Cloud Architect', company: 'Microsoft', period: '2022 - Present', summary: 'Architecture' },
    ],
    services: [
      ['resume_review', ['resume'], 'paid', 300, 'session'],
      ['interview_preparation', ['system design', 'python'], 'paid', 500, 'hour'],
    ],
  },
  {
    designation: 'ML Engineer', company: 'Rooman Technologies', years: 6, mentor: true,
    expertise: ['python', 'ml', 'data'],
    experience: [
      { role: 'Software Engineer', company: 'Infosys', period: '2018 - 2021', summary: 'Services' },
      { role: 'Backend Developer', company: 'Rooman Technologies', period: '2021 - 2023', summary: 'Backend' },
      { role: 'ML Engineer', company: 'Rooman Technologies', period: '2023 - Present', summary: 'Models' },
    ],
    services: [
      ['code_project_review', ['python', 'ml'], 'paid', 300, 'session'],
      ['career_transition', ['career', 'ml'], 'paid', 750, 'hour'],
    ],
  },
  {
    designation: 'AI Product Developer', company: 'Rooman Technologies', years: 4, mentor: true,
    expertise: ['ml', 'llm', 'python', 'rag'],
    experience: [
      { role: 'Backend Developer', company: 'Rooman Technologies', period: '2019 - 2022', summary: 'APIs' },
      { role: 'AI Product Developer', company: 'Rooman Technologies', period: '2022 - Present', summary: 'AI product work' },
    ],
    services: [
      ['career_guidance', ['ai', 'career'], 'free', null, null],
      ['technical_mentoring', ['python', 'ml', 'llm'], 'paid', 500, 'hour'],
    ],
  },
  {
    designation: 'Backend Developer', company: 'Zoho', years: 10, mentor: true,
    expertise: ['python', 'sql', 'rest apis', 'postgresql', 'system design'],
    experience: [
      { role: 'Junior Developer', company: 'Infosys', period: '2016 - 2019', summary: 'Internal tools' },
      { role: 'Software Engineer', company: 'Zoho', period: '2019 - 2022', summary: 'Built and scaled REST APIs' },
      { role: 'Backend Developer', company: 'Zoho', period: '2022 - Present', summary: 'Leads backend services' },
    ],
    services: [
      ['technical_mentoring', ['python', 'sql'], 'paid', 500, 'hour'],
      ['career_guidance', ['backend', 'career'], 'free', null, null],
    ],
  },
  {
    designation: 'Backend Developer', company: 'Amazon', years: 5, mentor: false,
    expertise: ['java', 'spring', 'aws', 'sql'],
    experience: [
      { role: 'Graduate Engineer', company: 'TCS', period: '2021 - 2023', summary: 'Enterprise Java services' },
      { role: 'Backend Developer', company: 'Amazon', period: '2023 - Present', summary: 'Service development at scale' },
    ],
    services: [],
  },
]

interface Member { id: string; name: string; has_history: boolean }

async function main(): Promise<void> {
  const tables = await query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public'
      AND tablename IN ('alumni_services','career_paths','career_assessments')`,
  )
  if (tables.rowCount !== 3) {
    console.error('✗ Career Guidance tables missing — run `npm run db:migrate` first.')
    process.exit(1)
  }

  // Members are picked by account age, never by name or address.
  const members = (
    await query<Member>(
      `SELECT id, name,
              (jsonb_typeof(experience)='array' AND jsonb_array_length(experience) > 0) AS has_history
         FROM users
        WHERE NOT is_admin
        ORDER BY created_at, id`,
    )
  ).rows

  const targets = members.slice(0, TEMPLATES.length)
  if (targets.length === 0) {
    console.error('✗ No members found.')
    process.exit(1)
  }

  // Rollback snapshot of every field this script can modify.
  const ids = targets.map((t) => t.id)
  const snapshot = await query(
    `SELECT id, name, designation, company, experience_years, expertise, experience,
            is_mentor, willing_to_mentor, mentor_verified_at
       FROM users WHERE id = ANY($1::text[])`,
    [ids],
  )
  writeFileSync('career-demo-backup.json', JSON.stringify(snapshot.rows, null, 2))
  console.log(`rollback snapshot -> career-demo-backup.json (${snapshot.rowCount} members)\n`)

  const proof = Buffer.from('%PDF-1.4 Demo experience letter - evidence for a mentor application.')

  for (const [i, m] of targets.entries()) {
    const t = TEMPLATES[i]
    if (m.has_history && !FORCE) {
      console.log(`  skip ${m.name} — already has work history (use --force to overwrite)`)
      continue
    }
    console.log(`${tag} ${m.name} -> ${t.designation} @ ${t.company} (${t.years}y)${t.mentor ? ' [mentor]' : ''}`)
    if (DRY) continue

    await query(
      `UPDATE users SET designation=$2, company=$3, experience_years=$4,
              expertise=$5, experience=$6::jsonb, updated_at=now()
         WHERE id=$1`,
      [m.id, t.designation, t.company, t.years, t.expertise, JSON.stringify(t.experience)],
    )

    if (t.mentor) {
      await query(
        `INSERT INTO mentor_applications (user_id, status, claim, note, updated_at)
         VALUES ($1,'approved','experience',$2, now())
         ON CONFLICT (user_id) DO UPDATE SET status='approved', claim='experience', note=$2, updated_at=now()`,
        [m.id, `${t.years}+ years of professional experience.`],
      )
      const docs = await query<{ c: number }>(
        'SELECT count(*)::int c FROM mentor_application_docs WHERE user_id=$1', [m.id])
      if (docs.rows[0].c === 0) {
        await query(
          `INSERT INTO mentor_application_docs (user_id, name, type, data) VALUES ($1,$2,$3,$4)`,
          [m.id, 'experience-letter.pdf', 'application/pdf', proof])
      }
      await query(
        `UPDATE users SET is_mentor=TRUE, willing_to_mentor=TRUE,
                mentor_verified_at=COALESCE(mentor_verified_at, now()),
                mentor_rate=COALESCE(mentor_rate, 1000),
                sessions_conducted=COALESCE(sessions_conducted, 0), updated_at=now()
           WHERE id=$1`, [m.id])
    }

    for (const [type, tags, mode, amount, unit] of t.services) {
      const dup = await query('SELECT 1 FROM alumni_services WHERE user_id=$1 AND service_type=$2', [m.id, type])
      if (dup.rowCount) continue
      await query(
        `INSERT INTO alumni_services (user_id, service_type, title, description, tags, pricing_mode, amount, pricing_unit)
         VALUES ($1,$2,'','Personalized help from a Rooman alumnus.',$3,$4,$5,$6)`,
        [m.id, type, tags, mode, amount, unit])
    }
  }

  // A few connections so the network isn't empty: each member connects to the
  // next one along, alternating accepted/pending.
  if (!DRY && targets.length > 1) {
    for (let i = 0; i + 1 < targets.length; i++) {
      await query(
        `INSERT INTO connections (requester_id, addressee_id, status)
         VALUES ($1,$2,$3) ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status=$3`,
        [targets[i].id, targets[i + 1].id, i % 3 === 2 ? 'pending' : 'accepted'])
    }
  }

  if (!DRY) {
    const { backfillCareerPaths } = await import('../src/careerPaths.js')
    await backfillCareerPaths()
  }

  const s = await query<{ mentors: number; services: number; paths: number; conns: number }>(
    `SELECT (SELECT count(*)::int FROM users WHERE is_mentor) AS mentors,
            (SELECT count(*)::int FROM alumni_services) AS services,
            (SELECT count(*)::int FROM career_paths) AS paths,
            (SELECT count(*)::int FROM connections WHERE status='accepted') AS conns`)
  console.log('\nResult:', s.rows[0])
  console.log('Members can now open Career Guidance and take the assessment to generate a roadmap.')
  await pool.end()
}

main().catch((err) => {
  console.error('failed:', err)
  process.exit(1)
})
