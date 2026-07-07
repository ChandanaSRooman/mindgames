// Seed data ported from the frontend mock (frontend/src/data/mockData.ts) so a
// freshly migrated database renders exactly like the original demo.
// Column names here are snake_case to match the SQL schema.

export interface SeedUser {
  id: string
  name: string
  email: string
  phone?: string
  is_admin?: boolean
  avatar: string
  batch_year: number
  course: string
  company: string
  designation: string
  experience_years: number
  domain: string
  employment_type: string
  city: string
  bio: string
  linkedin?: string
  expertise: string[]
  willing_to_mentor: boolean
  interested_in_startup: boolean
  connections_count: number
  is_mentor: boolean
  mentor_rate?: number
  sessions_conducted?: number
  /** When false, no password is set (e.g. the official Rooman account). */
  hasPassword?: boolean
}

export const seedUsers: SeedUser[] = [
  { id: 'rooman', name: 'Rooman Technologies', email: 'network@rooman.com', is_admin: true, avatar: 'Rooman Technologies', batch_year: 2000, course: 'Official Account', company: 'Rooman Technologies', designation: 'Official · Alumni Network', experience_years: 25, domain: 'Web Dev', employment_type: 'Employed', city: 'Bengaluru', bio: 'Official account of Rooman Technologies — 25 years, 500,000+ alumni.', expertise: ['Training', 'Placements', 'StartupVarsity'], willing_to_mentor: false, interested_in_startup: false, connections_count: 500000, is_mentor: false, hasPassword: true },
  // Console administrator. Password comes from ADMIN_PASSWORD in .env (falls
  // back to SEED_PASSWORD) — see seed.ts.
  { id: 'admin', name: 'Rooman Admin', email: 'admin@rooman.com', is_admin: true, avatar: 'Rooman Admin', batch_year: 2000, course: 'Administration', company: 'Rooman Technologies', designation: 'Administrator · Alumni Network', experience_years: 25, domain: 'Web Dev', employment_type: 'Employed', city: 'Bengaluru', bio: 'Rooman Technologies alumni network administrator.', expertise: ['Administration', 'Alumni Relations'], willing_to_mentor: false, interested_in_startup: false, connections_count: 0, is_mentor: false, hasPassword: true },
  { id: 'me', name: 'You', email: 'you@rooman.alumni', phone: '+91 90000 00000', avatar: 'You', batch_year: 2019, course: 'Full-Stack Web Development', company: 'Freelance', designation: 'Software Engineer', experience_years: 4, domain: 'Web Dev', employment_type: 'Employed', city: 'Bengaluru', bio: 'Rooman alumnus building things on the web. Complete onboarding to personalise your profile.', linkedin: 'https://linkedin.com/in/you', expertise: ['React', 'TypeScript', 'Node.js'], willing_to_mentor: false, interested_in_startup: true, connections_count: 86, is_mentor: false, hasPassword: true },
  { id: 'a1', name: 'Aarav Sharma', email: 'aarav.sharma@example.com', avatar: 'Aarav Sharma', batch_year: 2016, course: 'Java Full Stack', company: 'Amazon', designation: 'Senior Backend Engineer', experience_years: 9, domain: 'Cloud', employment_type: 'Employed', city: 'Bengaluru', bio: 'Scaling distributed systems at Amazon. Love mentoring juniors on system design.', expertise: ['AWS', 'Java', 'Distributed Systems', 'System Design'], willing_to_mentor: true, interested_in_startup: false, connections_count: 740, is_mentor: true, mentor_rate: 1500, sessions_conducted: 42, hasPassword: true },
  { id: 'a2', name: 'Priya Nair', email: 'priya.nair@example.com', avatar: 'Priya Nair', batch_year: 2020, course: 'Front-End Engineering', company: 'Razorpay', designation: 'Frontend Developer', experience_years: 5, domain: 'Web Dev', employment_type: 'Employed', city: 'Bengaluru', bio: 'Frontend dev passionate about design systems and web performance.', expertise: ['React', 'Design Systems', 'Performance', 'CSS'], willing_to_mentor: false, interested_in_startup: true, connections_count: 312, is_mentor: false, hasPassword: true },
  { id: 'a3', name: 'Rohan Verma', email: 'rohan.verma@example.com', avatar: 'Rohan Verma', batch_year: 2024, course: 'MERN Stack', company: 'Looking for opportunity', designation: 'Fresh Graduate', experience_years: 0, domain: 'Web Dev', employment_type: 'Looking for opportunity', city: 'Pune', bio: 'Recent graduate hunting for my first React role. Built 3 full-stack side projects.', expertise: ['React', 'Node.js', 'MongoDB'], willing_to_mentor: false, interested_in_startup: true, connections_count: 58, is_mentor: false, hasPassword: true },
  { id: 'a4', name: 'Sneha Iyer', email: 'sneha.iyer@example.com', avatar: 'Sneha Iyer', batch_year: 2012, course: 'Software Testing', company: 'Microsoft', designation: 'Engineering Manager', experience_years: 13, domain: 'Cloud', employment_type: 'Employed', city: 'Hyderabad', bio: 'EM at Microsoft. I hire Rooman alumni — the fundamentals show.', expertise: ['Leadership', 'Azure', 'Hiring', 'Agile'], willing_to_mentor: true, interested_in_startup: false, connections_count: 980, is_mentor: true, mentor_rate: 2000, sessions_conducted: 67, hasPassword: true },
  { id: 'a5', name: 'Karthik Reddy', email: 'karthik.reddy@example.com', avatar: 'Karthik Reddy', batch_year: 2018, course: 'DevOps Engineering', company: 'Flipkart', designation: 'DevOps Engineer', experience_years: 7, domain: 'DevOps', employment_type: 'Employed', city: 'Bengaluru', bio: 'Kubernetes wrangler. CI/CD enthusiast. Coffee-driven pipelines.', expertise: ['Kubernetes', 'Docker', 'Terraform', 'CI/CD'], willing_to_mentor: true, interested_in_startup: false, connections_count: 421, is_mentor: true, mentor_rate: 1200, sessions_conducted: 18, hasPassword: true },
  { id: 'a6', name: 'Ananya Gupta', email: 'ananya.gupta@example.com', avatar: 'Ananya Gupta', batch_year: 2022, course: 'Data Analytics', company: 'Looking for opportunity', designation: 'Data Analyst', experience_years: 2, domain: 'Data', employment_type: 'Looking for opportunity', city: 'Delhi', bio: 'Analytics & BI. Cut reporting time 60% with better dashboards last quarter.', expertise: ['SQL', 'Power BI', 'Python', 'Tableau'], willing_to_mentor: false, interested_in_startup: false, connections_count: 134, is_mentor: false, hasPassword: true },
  { id: 'a7', name: 'Vikram Singh', email: 'vikram.singh@example.com', avatar: 'Vikram Singh', batch_year: 2010, course: 'Embedded Systems', company: 'NeuralEdge (Founder)', designation: 'Founder & CEO', experience_years: 15, domain: 'AI/ML', employment_type: 'Entrepreneur', city: 'Bengaluru', bio: 'Building edge-AI hardware. StartupVarsity alum. Always happy to guide founders.', expertise: ['Entrepreneurship', 'Edge AI', 'Fundraising', 'Hardware'], willing_to_mentor: true, interested_in_startup: true, connections_count: 1240, is_mentor: true, mentor_rate: 2500, sessions_conducted: 31, hasPassword: true },
  { id: 'a8', name: 'Meera Krishnan', email: 'meera.krishnan@example.com', avatar: 'Meera Krishnan', batch_year: 2015, course: 'Quality Assurance', company: 'Zoho', designation: 'QA Lead', experience_years: 10, domain: 'Web Dev', employment_type: 'Employed', city: 'Chennai', bio: 'Quality-first engineer. Automation testing advocate.', expertise: ['Selenium', 'Cypress', 'Test Strategy', 'Playwright'], willing_to_mentor: true, interested_in_startup: false, connections_count: 388, is_mentor: true, mentor_rate: 1000, sessions_conducted: 12, hasPassword: true },
  { id: 'a9', name: 'Sahil Khan', email: 'sahil.khan@example.com', avatar: 'Sahil Khan', batch_year: 2014, course: 'Cloud Computing', company: 'Google', designation: 'Cloud Architect', experience_years: 11, domain: 'Cloud', employment_type: 'Employed', city: 'Bengaluru', bio: 'Cloud architect @ Google. Hosting free AWS/GCP AMAs for interview prep.', expertise: ['GCP', 'AWS', 'Architecture', 'Kubernetes'], willing_to_mentor: true, interested_in_startup: false, connections_count: 905, is_mentor: true, mentor_rate: 1800, sessions_conducted: 54, hasPassword: true },
  { id: 'a10', name: 'Divya Menon', email: 'divya.menon@example.com', avatar: 'Divya Menon', batch_year: 2019, course: 'UI/UX Design', company: 'Freshworks', designation: 'Senior Product Designer', experience_years: 6, domain: 'UI/UX', employment_type: 'Employed', city: 'Chennai', bio: 'Designing delightful B2B products. Mentoring designers breaking into tech.', expertise: ['Figma', 'Product Design', 'User Research', 'Prototyping'], willing_to_mentor: true, interested_in_startup: true, connections_count: 276, is_mentor: true, mentor_rate: 1300, sessions_conducted: 9, hasPassword: true },
  { id: 'a11', name: 'Imran Qureshi', email: 'imran.qureshi@example.com', avatar: 'Imran Qureshi', batch_year: 2017, course: 'Cybersecurity', company: 'CloudSEK', designation: 'Security Engineer', experience_years: 8, domain: 'Cybersecurity', employment_type: 'Employed', city: 'Bengaluru', bio: 'Breaking things so attackers can’t. Pentester turned blue-teamer.', expertise: ['Pentesting', 'SIEM', 'Cloud Security', 'Threat Intel'], willing_to_mentor: false, interested_in_startup: false, connections_count: 198, is_mentor: false, hasPassword: true },
]

export interface SeedComment {
  id: string
  author_id: string
  text: string
  created_at: string
}

export interface SeedPost {
  id: string
  author_id: string
  type: string
  content: string
  created_at: string
  likes: number
  visibility: string
  community_id?: string
  domain?: string
  city?: string
  batch?: number
  role?: string
  company?: string
  pinned?: boolean
  comments: SeedComment[]
}

export const seedPosts: SeedPost[] = [
  { id: 'p1', author_id: 'a4', type: 'Hiring', content: "My team at Microsoft is hiring 2 mid-level engineers (3–6 yrs) for our Azure Storage group. Strong preference for Rooman alumni — the fundamentals show. Drop your profile in the comments or DM me. 👇", created_at: '2026-06-27T08:30:00.000Z', likes: 67, role: 'Software Engineer II', company: 'Microsoft', domain: 'Cloud', city: 'Hyderabad', visibility: 'All Alumni', comments: [ { id: 'c1', author_id: 'a3', text: 'Interested! Sending my profile now.', created_at: '2026-06-27T09:00:00.000Z' }, { id: 'c2', author_id: 'a6', text: 'Is this open to analysts transitioning to SDE?', created_at: '2026-06-27T09:20:00.000Z' } ] },
  { id: 'p2', author_id: 'a3', type: 'Open to Work', content: 'Just graduated and actively looking for my first React role. Built 3 full-stack projects this year. Would love a referral or a portfolio review from a senior. Resume in comments.', created_at: '2026-06-27T05:10:00.000Z', likes: 24, domain: 'Web Dev', city: 'Pune', visibility: 'All Alumni', comments: [ { id: 'c3', author_id: 'a2', text: 'Happy to review your portfolio Rohan, ping me!', created_at: '2026-06-27T06:00:00.000Z' } ] },
  { id: 'p3', author_id: 'a7', type: 'Mentorship', content: 'Opening 3 paid mentorship slots this month for aspiring founders and backend engineers. We cover system design, fundraising and going 0→1. Book via my profile — Rooman network gets priority. 🚀', created_at: '2026-06-26T14:00:00.000Z', likes: 51, domain: 'AI/ML', city: 'Bengaluru', visibility: 'All Alumni', comments: [] },
  { id: 'p4', author_id: 'a9', type: 'Update', content: 'Hosting a FREE AWS architecture AMA next Friday for anyone prepping for cloud interviews. We’ll whiteboard a real scaling problem live. StartupVarsity folks especially welcome!', created_at: '2026-06-26T09:20:00.000Z', likes: 88, domain: 'Cloud', visibility: 'All Alumni', community_id: 'comm1', comments: [ { id: 'c4', author_id: 'a5', text: 'Count me in. Friday works.', created_at: '2026-06-26T10:00:00.000Z' } ] },
  { id: 'p5', author_id: 'a7', type: 'StartupVarsity', content: 'NeuralEdge just crossed our first 10 paying customers! Huge thanks to the StartupVarsity lab and mentors who helped us get the hardware prototype off the ground. Hiring an embedded engineer soon. 🔧', created_at: '2026-06-25T16:45:00.000Z', likes: 132, domain: 'AI/ML', city: 'Bengaluru', visibility: 'All Alumni', comments: [ { id: 'c5', author_id: 'a1', text: 'Massive congrats Vikram! 🎉', created_at: '2026-06-25T17:30:00.000Z' }, { id: 'c6', author_id: 'a4', text: 'So proud of this. The lab works.', created_at: '2026-06-25T18:10:00.000Z' } ] },
  { id: 'p6', author_id: 'a6', type: 'Open to Work', content: 'Open to new opportunities in Analytics / BI (Delhi or remote). Built 3 dashboards last quarter that cut reporting time by 60%. SQL + Power BI + Python. Happy to do a take-home.', created_at: '2026-06-25T11:00:00.000Z', likes: 29, domain: 'Data', city: 'Delhi', visibility: 'All Alumni', comments: [] },
  { id: 'p7', author_id: 'a2', type: 'Update', content: 'Shipped a full design-system revamp at Razorpay this sprint — cut our component count by 40% and improved Lighthouse scores across the board. Grateful for the CSS foundations from my Rooman days. 💜', created_at: '2026-06-24T13:15:00.000Z', likes: 74, domain: 'Web Dev', city: 'Bengaluru', visibility: 'All Alumni', comments: [] },
]

// The current user ('me') has liked + saved p3 in the original mock.
export const seedLikes: Array<{ post_id: string; user_id: string }> = [{ post_id: 'p3', user_id: 'me' }]
export const seedSaves: Array<{ post_id: string; user_id: string }> = [{ post_id: 'p3', user_id: 'me' }]

// Connections relative to 'me': accepted with a1/a3/a4/a7/a9; a2 has a pending
// request awaiting 'me'. Suggestions (a5/a8/a10/a11/a6) get no row.
export const seedConnections: Array<{ requester_id: string; addressee_id: string; status: string }> = [
  { requester_id: 'me', addressee_id: 'a1', status: 'accepted' },
  { requester_id: 'me', addressee_id: 'a3', status: 'accepted' },
  { requester_id: 'me', addressee_id: 'a4', status: 'accepted' },
  { requester_id: 'me', addressee_id: 'a7', status: 'accepted' },
  { requester_id: 'me', addressee_id: 'a9', status: 'accepted' },
  { requester_id: 'a2', addressee_id: 'me', status: 'pending' },
]

// Admin directory: contacts to invite (was the old in-memory Alumni list).
export interface SeedInvitee {
  id: string
  name: string
  phone: string
  email: string
  role: string
  batch_year: number
  status_tags: string[]
}

// Direct-message seed for 'me' with a1/a2/a7 (mirrors the mock threads).
// unread is derived: a1's thread has no read cursor → its 1 incoming msg is unread.
export interface SeedConversation {
  id: string
  withUserId: string // the other participant ('me' is always the current demo user)
  messages: Array<{ id: string; from: string; body: string; created_at: string }>
  meReadAt?: string // last_read_at for 'me'; omit to leave incoming unread
}

export const seedConversations: SeedConversation[] = [
  {
    id: 'conv1',
    withUserId: 'a1',
    messages: [
      { id: 'mm1', from: 'me', body: 'Hi Aarav! Could we do the system design session Monday?', created_at: '2026-06-26T09:02:00.000Z' },
      { id: 'mm2', from: 'a1', body: 'Sure, send the calendar invite for Monday.', created_at: '2026-06-26T09:10:00.000Z' },
    ],
    // no meReadAt → mm2 (from a1) counts as 1 unread
  },
  {
    id: 'conv2',
    withUserId: 'a2',
    messages: [
      { id: 'mm3', from: 'a2', body: 'Loved your portfolio revamp 🔥', created_at: '2026-06-25T15:00:00.000Z' },
    ],
    meReadAt: '2026-06-26T00:00:00.000Z',
  },
  {
    id: 'conv3',
    withUserId: 'a7',
    messages: [
      { id: 'mm4', from: 'me', body: 'Congrats on the 10 customers!', created_at: '2026-06-24T11:00:00.000Z' },
      { id: 'mm5', from: 'a7', body: 'Thank you! StartupVarsity made it happen.', created_at: '2026-06-24T11:05:00.000Z' },
    ],
    meReadAt: '2026-06-25T00:00:00.000Z',
  },
]

// Communities (member_count is the displayed total; membersMe marks 'me' joined).
export interface SeedCommunity {
  id: string
  name: string
  description: string
  category: string
  tag: string
  color: string
  member_count: number
  meJoined: boolean
}

export const seedCommunities: SeedCommunity[] = [
  { id: 'comm1', name: 'Bangalore Cloud Alumni', description: 'Cloud & DevOps engineers from Rooman based in Bengaluru. Job leads, AMAs, study groups.', category: 'Domain', tag: 'Cloud', color: 'from-sky-500 to-blue-600', member_count: 1284, meJoined: true },
  { id: 'comm2', name: 'AI/ML Circle', description: 'Everything machine learning — papers, projects, interview prep and GPU war stories.', category: 'Domain', tag: 'AI/ML', color: 'from-violet-500 to-fuchsia-600', member_count: 932, meJoined: true },
  { id: 'comm3', name: 'Rooman Entrepreneurs', description: 'Founders & aspiring founders from the alumni network. StartupVarsity grads welcome.', category: 'General', tag: 'Startup', color: 'from-orange-500 to-rose-600', member_count: 466, meJoined: false },
  { id: 'comm4', name: 'Web Dev Guild', description: 'Frontend & full-stack alumni sharing patterns, libraries and code reviews.', category: 'Domain', tag: 'Web Dev', color: 'from-emerald-500 to-teal-600', member_count: 1510, meJoined: false },
  { id: 'comm5', name: 'Chennai Alumni Hub', description: 'City community for Rooman alumni in Chennai. Meetups, referrals and local jobs.', category: 'City', tag: 'Chennai', color: 'from-amber-500 to-orange-600', member_count: 612, meJoined: false },
  { id: 'comm6', name: 'Batch of 2019', description: 'Reconnect with your cohort. Where is everyone now? Share your journey.', category: 'Batch', tag: '2019', color: 'from-indigo-500 to-purple-600', member_count: 240, meJoined: true },
  { id: 'comm7', name: 'CyberSec Defenders', description: 'Security alumni — CTFs, certifications, threat intel and blue-team tactics.', category: 'Domain', tag: 'Cybersecurity', color: 'from-slate-600 to-gray-800', member_count: 388, meJoined: false },
]

export interface SeedSession {
  id: string
  mentor_id: string
  mentee_id: string
  topic: string
  date_label: string
  time_label: string
  status: string
}

export const seedSessions: SeedSession[] = [
  { id: 's1', mentor_id: 'a1', mentee_id: 'me', topic: 'System Design Interview Prep', date_label: 'Mon, 30 Jun 2026', time_label: '6:00 PM IST', status: 'upcoming' },
  { id: 's2', mentor_id: 'a9', mentee_id: 'me', topic: 'AWS Architecture Deep-Dive', date_label: 'Fri, 4 Jul 2026', time_label: '7:30 PM IST', status: 'upcoming' },
  { id: 's3', mentor_id: 'a4', mentee_id: 'me', topic: 'Breaking into Engineering Management', date_label: 'Thu, 12 Jun 2026', time_label: '5:00 PM IST', status: 'past' },
]

// Alumni whose mentor applications await admin approval.
export const seedMentorApplications = ['a2', 'a6', 'a3']

export interface SeedStartup {
  id: string
  founder_id: string
  name: string
  domain: string
  stage: string
  team_size: number
  description: string
}

export const seedStartups: SeedStartup[] = [
  { id: 'st1', founder_id: 'a7', name: 'NeuralEdge', domain: 'AI/ML', stage: 'Early Revenue', team_size: 6, description: 'Edge-AI hardware that runs vision models on-device with zero cloud dependency.' },
  { id: 'st2', founder_id: 'a2', name: 'PixelPerfect', domain: 'Web Dev', stage: 'MVP', team_size: 3, description: 'A design-to-code engine that turns Figma files into production React components.' },
]

export interface SeedNotification {
  id: string
  user_id: string
  type: string
  text: string
  actor_id?: string
  read: boolean
  created_at: string
}

export const seedNotifications: SeedNotification[] = [
  { id: 'n1', user_id: 'me', type: 'connection', actor_id: 'a2', text: 'Priya Nair sent you a connection request.', created_at: '2026-06-27T08:45:00.000Z', read: false },
  { id: 'n2', user_id: 'me', type: 'like', actor_id: 'a1', text: 'Aarav Sharma and 24 others liked your post.', created_at: '2026-06-27T07:10:00.000Z', read: false },
  { id: 'n3', user_id: 'me', type: 'mentorship', actor_id: 'a9', text: 'Your mentorship session with Sahil Khan is confirmed for Fri, 4 Jul.', created_at: '2026-06-26T15:00:00.000Z', read: false },
  { id: 'n4', user_id: 'me', type: 'job', text: 'A new Hiring post matches your domain (Web Dev).', created_at: '2026-06-26T12:00:00.000Z', read: true },
  { id: 'n5', user_id: 'me', type: 'comment', actor_id: 'a3', text: 'Rohan Verma commented on a post you follow.', created_at: '2026-06-26T10:30:00.000Z', read: true },
  { id: 'n6', user_id: 'me', type: 'announcement', text: '📢 Rooman: Alumni Summit 2026 registrations are now open!', created_at: '2026-06-25T09:00:00.000Z', read: true },
]

export const seedInvitees: SeedInvitee[] = [
  { id: 'i1', name: 'Aarav Sharma', phone: '+91 98450 11223', email: 'aarav.sharma@example.com', role: 'Senior Backend Engineer', batch_year: 2016, status_tags: ['Working', 'Can mentor'] },
  { id: 'i2', name: 'Priya Nair', phone: '+91 99020 44556', email: 'priya.nair@example.com', role: 'Frontend Developer', batch_year: 2020, status_tags: ['Working', 'Need mentoring'] },
  { id: 'i3', name: 'Rohan Verma', phone: '+91 98801 77889', email: 'rohan.verma@example.com', role: 'Fresh Graduate', batch_year: 2024, status_tags: ['Ready to work', 'Need mentoring'] },
  { id: 'i4', name: 'Sneha Iyer', phone: '+91 91080 33445', email: 'sneha.iyer@example.com', role: 'Engineering Manager', batch_year: 2012, status_tags: ['Working', 'Can mentor'] },
  { id: 'i5', name: 'Karthik Reddy', phone: '+91 97410 99001', email: 'karthik.reddy@example.com', role: 'DevOps Engineer', batch_year: 2018, status_tags: ['Working'] },
  { id: 'i6', name: 'Ananya Gupta', phone: '+91 98860 22113', email: 'ananya.gupta@example.com', role: 'Data Analyst', batch_year: 2022, status_tags: ['Ready to work'] },
  { id: 'i7', name: 'Vikram Singh', phone: '+91 90080 55667', email: 'vikram.singh@example.com', role: 'Startup Founder', batch_year: 2010, status_tags: ['Can mentor'] },
  { id: 'i8', name: 'Meera Krishnan', phone: '+91 99450 88776', email: 'meera.krishnan@example.com', role: 'QA Lead', batch_year: 2015, status_tags: ['Working', 'Can mentor'] },
]
