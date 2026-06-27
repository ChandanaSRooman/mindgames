// Seed data + shared shapes for the Rooman Alumni Network API.
// This is an in-memory store — restarting the server resets it.

export type StatusTag = 'Ready to work' | 'Working' | 'Can mentor' | 'Need mentoring'

export interface Alumni {
  id: string
  name: string
  phone: string
  email: string
  role: string
  batchYear: number
  statusTags: StatusTag[]
}

export interface Post {
  id: string
  authorName: string
  authorRole: string
  authorTags: StatusTag[]
  content: string
  createdAt: string // ISO string
  likes: number
}

export interface Experience {
  role: string
  company: string
  period: string
  summary: string
}

export interface ResumeParseResult {
  headline: string
  experience: Experience[]
  skills: string[]
}

export const alumni: Alumni[] = [
  { id: 'a1', name: 'Aarav Sharma', phone: '+91 98450 11223', email: 'aarav.sharma@example.com', role: 'Senior Backend Engineer', batchYear: 2016, statusTags: ['Working', 'Can mentor'] },
  { id: 'a2', name: 'Priya Nair', phone: '+91 99020 44556', email: 'priya.nair@example.com', role: 'Frontend Developer', batchYear: 2020, statusTags: ['Working', 'Need mentoring'] },
  { id: 'a3', name: 'Rohan Verma', phone: '+91 98801 77889', email: 'rohan.verma@example.com', role: 'Fresh Graduate', batchYear: 2024, statusTags: ['Ready to work', 'Need mentoring'] },
  { id: 'a4', name: 'Sneha Iyer', phone: '+91 91080 33445', email: 'sneha.iyer@example.com', role: 'Engineering Manager', batchYear: 2012, statusTags: ['Working', 'Can mentor'] },
  { id: 'a5', name: 'Karthik Reddy', phone: '+91 97410 99001', email: 'karthik.reddy@example.com', role: 'DevOps Engineer', batchYear: 2018, statusTags: ['Working'] },
  { id: 'a6', name: 'Ananya Gupta', phone: '+91 98860 22113', email: 'ananya.gupta@example.com', role: 'Data Analyst', batchYear: 2022, statusTags: ['Ready to work'] },
  { id: 'a7', name: 'Vikram Singh', phone: '+91 90080 55667', email: 'vikram.singh@example.com', role: 'Startup Founder', batchYear: 2010, statusTags: ['Can mentor'] },
  { id: 'a8', name: 'Meera Krishnan', phone: '+91 99450 88776', email: 'meera.krishnan@example.com', role: 'QA Lead', batchYear: 2015, statusTags: ['Working', 'Can mentor'] },
  { id: 'a9', name: 'Aditya Rao', phone: '+91 96320 11009', email: 'aditya.rao@example.com', role: 'Junior Developer', batchYear: 2023, statusTags: ['Working', 'Need mentoring'] },
  { id: 'a10', name: 'Divya Menon', phone: '+91 90350 66554', email: 'divya.menon@example.com', role: 'UX Designer', batchYear: 2019, statusTags: ['Ready to work', 'Can mentor'] },
  { id: 'a11', name: 'Sahil Khan', phone: '+91 98190 33221', email: 'sahil.khan@example.com', role: 'Cloud Architect', batchYear: 2014, statusTags: ['Working', 'Can mentor'] },
  { id: 'a12', name: 'Nisha Pillai', phone: '+91 97390 44332', email: 'nisha.pillai@example.com', role: 'Fresh Graduate', batchYear: 2025, statusTags: ['Ready to work', 'Need mentoring'] },
]

export const posts: Post[] = [
  { id: 'p1', authorName: 'Vikram Singh', authorRole: 'Startup Founder', authorTags: ['Can mentor'], content: 'We just opened 3 paid mentorship slots at StartupVarsity for backend engineers. DM me if you are mentoring-curious — happy to guide juniors from the network. 🚀', createdAt: '2026-06-26T09:30:00.000Z', likes: 42 },
  { id: 'p2', authorName: 'Rohan Verma', authorRole: 'Fresh Graduate', authorTags: ['Ready to work', 'Need mentoring'], content: 'Just graduated and actively looking for my first React role. Looking for a mentor who can review my portfolio. Any seniors open to a quick chat?', createdAt: '2026-06-26T14:10:00.000Z', likes: 18 },
  { id: 'p3', authorName: 'Sneha Iyer', authorRole: 'Engineering Manager', authorTags: ['Can mentor'], content: 'My team is hiring 2 mid-level engineers. Strong preference for Rooman alumni — the fundamentals show. Drop your profile below. 👇', createdAt: '2026-06-25T11:00:00.000Z', likes: 67 },
  { id: 'p4', authorName: 'Ananya Gupta', authorRole: 'Data Analyst', authorTags: ['Ready to work'], content: 'Open to new opportunities in analytics / BI. Built 3 dashboards last quarter that cut reporting time by 60%. Resume in comments.', createdAt: '2026-06-24T16:45:00.000Z', likes: 29 },
  { id: 'p5', authorName: 'Sahil Khan', authorRole: 'Cloud Architect', authorTags: ['Can mentor'], content: 'Hosting a free AWS architecture AMA next Friday for anyone preparing for cloud interviews. The incubation track folks especially welcome.', createdAt: '2026-06-23T08:20:00.000Z', likes: 51 },
  { id: 'p6', authorName: 'Priya Nair', authorRole: 'Frontend Developer', authorTags: ['Need mentoring'], content: 'Trying to level up from mid to senior frontend. Would love a mentor strong in performance + design systems. Willing to pay for structured sessions.', createdAt: '2026-06-22T19:05:00.000Z', likes: 23 },
]

// The fixed result the "Parse with AI" simulation returns.
export const resumeParseResult: ResumeParseResult = {
  headline: 'Full-Stack Engineer · 5 years experience',
  experience: [
    { role: 'Senior Software Engineer', company: 'TechNova Solutions', period: '2022 — Present', summary: 'Led a 5-person team building a React + Node.js SaaS platform serving 40k MAU. Cut API latency 35%.' },
    { role: 'Software Engineer', company: 'BluePeak Labs', period: '2019 — 2022', summary: 'Built customer-facing dashboards in React/TypeScript and REST microservices in Node. Owned CI/CD pipeline.' },
    { role: 'Junior Developer', company: 'Rooman Incubation Cohort', period: '2018 — 2019', summary: 'Graduated top of cohort. Shipped 4 client projects across the MERN stack during the StartupVarsity program.' },
  ],
  skills: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'AWS', 'Docker', 'Tailwind CSS', 'REST APIs', 'CI/CD', 'System Design', 'Team Leadership'],
}
