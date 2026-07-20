// Resume-parse types + the mock result used as a demo fallback by ai.ts when
// no ANT_KEY is configured. All other domain data now lives in Postgres — see
// db/schema.sql and db/seed-data.ts.

export interface Experience {
  role: string
  company: string
  period: string
  summary: string
}

export interface ResumeParseResult {
  name: string
  email: string
  phone: string
  linkedin: string
  city: string
  headline: string
  bio: string
  // Numeric-ish fields are strings ("" when absent) — they map straight onto
  // the onboarding form's text inputs and keep the JSON schema strict-friendly.
  batchYear: string
  course: string
  experienceYears: string
  domain: string
  employmentType: string
  experience: Experience[]
  skills: string[]
  // 'ai' = real Claude extraction; 'fallback' = demo data (no ANT_KEY).
  source: 'ai' | 'fallback'
}

// The fixed result returned in demo mode (no ANT_KEY configured).
export const resumeParseResult: ResumeParseResult = {
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  phone: '+91 98765 43210',
  linkedin: 'https://linkedin.com/in/alexmorgan',
  city: 'Bengaluru',
  headline: 'Full-Stack Engineer · 5 years experience',
  bio: 'Full-stack engineer with 5 years of experience building React and Node.js products. Led a 5-person team shipping a SaaS platform to 40k monthly users.',
  batchYear: '2018',
  course: 'Full-Stack Web Development',
  experienceYears: '5',
  domain: 'Web Dev',
  employmentType: 'Employed',
  experience: [
    { role: 'Senior Software Engineer', company: 'TechNova Solutions', period: '2022 — Present', summary: 'Led a 5-person team building a React + Node.js SaaS platform serving 40k MAU. Cut API latency 35%.' },
    { role: 'Software Engineer', company: 'BluePeak Labs', period: '2019 — 2022', summary: 'Built customer-facing dashboards in React/TypeScript and REST microservices in Node. Owned CI/CD pipeline.' },
    { role: 'Junior Developer', company: 'Rooman Incubation Cohort', period: '2018 — 2019', summary: 'Graduated top of cohort. Shipped 4 client projects across the MERN stack during the StartupVarsity program.' },
  ],
  skills: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'AWS', 'Docker', 'Tailwind CSS', 'REST APIs', 'CI/CD', 'System Design', 'Team Leadership'],
  source: 'fallback',
}
