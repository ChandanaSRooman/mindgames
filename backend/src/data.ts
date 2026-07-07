// Resume-parse types + the mock result used as a fallback by ai.ts when no
// ANT_KEY is configured (or parsing fails). All other domain data now lives in
// Postgres — see db/schema.sql and db/seed-data.ts.

export interface Experience {
  role: string
  company: string
  period: string
  summary: string
}

export interface ResumeParseResult {
  name: string
  headline: string
  experience: Experience[]
  skills: string[]
}

// The fixed result the resume-parse fallback returns.
export const resumeParseResult: ResumeParseResult = {
  name: 'Alex Morgan',
  headline: 'Full-Stack Engineer · 5 years experience',
  experience: [
    { role: 'Senior Software Engineer', company: 'TechNova Solutions', period: '2022 — Present', summary: 'Led a 5-person team building a React + Node.js SaaS platform serving 40k MAU. Cut API latency 35%.' },
    { role: 'Software Engineer', company: 'BluePeak Labs', period: '2019 — 2022', summary: 'Built customer-facing dashboards in React/TypeScript and REST microservices in Node. Owned CI/CD pipeline.' },
    { role: 'Junior Developer', company: 'Rooman Incubation Cohort', period: '2018 — 2019', summary: 'Graduated top of cohort. Shipped 4 client projects across the MERN stack during the StartupVarsity program.' },
  ],
  skills: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'AWS', 'Docker', 'Tailwind CSS', 'REST APIs', 'CI/CD', 'System Design', 'Team Leadership'],
}
