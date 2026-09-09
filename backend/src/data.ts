// Resume-parse types + the mock result used as a demo fallback by ai.ts when
// no ANT_KEY is configured. All other domain data now lives in Postgres — see
// db/schema.sql and db/seed-data.ts.

export interface Experience {
  role: string
  company: string
  period: string
  summary: string
}

export interface Education {
  degree: string
  institution: string
  year: string
  score: string
}

export interface Project {
  title: string
  description: string
  link: string
  tech: string[]
}

export interface Certification {
  name: string
  issuer: string
  year: string
}

export interface Achievement {
  title: string
  year: string
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
  // Current college/institution name — only populated when employmentType is 'Student'.
  college: string
  experience: Experience[]
  skills: string[]
  // Rich detail. The uploaded file is discarded after parsing; this extracted
  // JSON is what gets persisted on the profile, and the member can edit it.
  education: Education[]
  projects: Project[]
  certifications: Certification[]
  achievements: Achievement[]
  languagesKnown: string[]
  interests: string[]
  github: string
  portfolio: string
  industry: string
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
  college: '',
  experience: [
    { role: 'Senior Software Engineer', company: 'TechNova Solutions', period: '2022 — Present', summary: 'Led a 5-person team building a React + Node.js SaaS platform serving 40k MAU. Cut API latency 35%.' },
    { role: 'Software Engineer', company: 'BluePeak Labs', period: '2019 — 2022', summary: 'Built customer-facing dashboards in React/TypeScript and REST microservices in Node. Owned CI/CD pipeline.' },
    { role: 'Junior Developer', company: 'Rooman Incubation Cohort', period: '2018 — 2019', summary: 'Graduated top of cohort. Shipped 4 client projects across the MERN stack during the StartupVarsity program.' },
  ],
  skills: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'AWS', 'Docker', 'Tailwind CSS', 'REST APIs', 'CI/CD', 'System Design', 'Team Leadership'],
  education: [
    { degree: 'B.E. Computer Science', institution: 'Visvesvaraya Technological University', year: '2018', score: '8.4 CGPA' },
  ],
  projects: [
    { title: 'Ledger', description: 'Open-source double-entry bookkeeping API used by three small businesses.', link: 'https://github.com/example/ledger', tech: ['Node.js', 'PostgreSQL'] },
  ],
  certifications: [
    { name: 'AWS Certified Solutions Architect - Associate', issuer: 'Amazon Web Services', year: '2021' },
  ],
  achievements: [{ title: 'Top of Rooman Full-Stack cohort', year: '2018' }],
  languagesKnown: ['English', 'Hindi', 'Kannada'],
  interests: ['Cycling', 'Open source'],
  github: 'https://github.com/alexmorgan',
  portfolio: 'https://alexmorgan.dev',
  industry: 'Product / SaaS',
  source: 'fallback',
}
