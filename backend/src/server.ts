import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import {
  alumni,
  posts,
  resumeParseResult,
  type Alumni,
  type Post,
  type StatusTag,
} from './data.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PORT = Number(process.env.PORT) || 4000

// --- Health -----------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// --- Alumni directory -------------------------------------------------------
app.get('/api/alumni', (_req, res) => res.json(alumni))

// Add a single alumnus (manual form). Skips duplicate emails.
app.post('/api/alumni', (req, res) => {
  const { name, phone, email } = req.body ?? {}
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' })
  if (alumni.some((a) => a.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'An alumnus with this email already exists' })
  }
  const created: Alumni = {
    id: randomUUID(),
    name: String(name),
    phone: String(phone ?? ''),
    email: String(email),
    role: 'New Member',
    batchYear: new Date().getFullYear(),
    statusTags: [],
  }
  alumni.push(created)
  res.status(201).json(created)
})

// Bulk add from CSV (frontend parses, sends rows). Returns added + skipped.
app.post('/api/alumni/bulk', (req, res) => {
  const rows: Array<{ name?: string; phone?: string; email?: string }> = req.body?.rows ?? []
  const added: Alumni[] = []
  const skipped: Array<{ email?: string; reason: string }> = []
  for (const row of rows) {
    if (!row.name || !row.email) {
      skipped.push({ email: row.email, reason: 'missing name or email' })
      continue
    }
    if (alumni.some((a) => a.email.toLowerCase() === row.email!.toLowerCase())) {
      skipped.push({ email: row.email, reason: 'duplicate email' })
      continue
    }
    const created: Alumni = {
      id: randomUUID(),
      name: row.name,
      phone: row.phone ?? '',
      email: row.email,
      role: 'New Member',
      batchYear: new Date().getFullYear(),
      statusTags: [],
    }
    alumni.push(created)
    added.push(created)
  }
  res.status(201).json({ added, skipped })
})

// --- Invitations (simulated send) -------------------------------------------
app.post('/api/invites/batch', (req, res) => {
  // ponytail: no real email/WhatsApp sending — we just count and echo back.
  const invites: Array<{ id: string; email?: boolean; whatsapp?: boolean }> = req.body?.invites ?? []
  const emailCount = invites.filter((i) => i.email).length
  const whatsappCount = invites.filter((i) => i.whatsapp).length
  res.json({
    emailCount,
    whatsappCount,
    total: emailCount + whatsappCount,
    message: `Sent ${emailCount} email and ${whatsappCount} WhatsApp invitation(s).`,
  })
})

// --- Auth (simulated) -------------------------------------------------------
app.post('/api/auth/signup', (req, res) => {
  const { email } = req.body ?? {}
  if (!email) return res.status(400).json({ error: 'email is required' })
  // ponytail: no real auth — returns a fake session token.
  res.status(201).json({ token: `demo-${randomUUID()}`, email })
})

app.post('/api/auth/social/:provider', (req, res) => {
  const provider = req.params.provider
  if (provider !== 'google' && provider !== 'linkedin') {
    return res.status(400).json({ error: 'unsupported provider' })
  }
  res.status(201).json({ token: `demo-${randomUUID()}`, provider })
})

// --- Resume parsing (simulated AI) ------------------------------------------
app.post('/api/resume/parse', (_req, res) => {
  // ponytail: ignores the uploaded file and returns a fixed mock parse result.
  res.json(resumeParseResult)
})

// --- Feed -------------------------------------------------------------------
app.get('/api/feed', (req, res) => {
  const tagParam = req.query.tags
  if (!tagParam) return res.json(posts)
  const tags = String(tagParam).split(',').filter(Boolean) as StatusTag[]
  const filtered = posts.filter((p) => p.authorTags.some((t) => tags.includes(t)))
  res.json(filtered)
})

app.post('/api/feed', (req, res) => {
  const { content, authorName, authorRole, authorTags } = req.body ?? {}
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'content is required' })
  }
  const post: Post = {
    id: randomUUID(),
    authorName: authorName || 'You',
    authorRole: authorRole || 'Alumni Member',
    authorTags: Array.isArray(authorTags) ? authorTags : [],
    content: String(content).trim(),
    createdAt: new Date().toISOString(),
    likes: 0,
  }
  posts.unshift(post)
  res.status(201).json(post)
})

app.listen(PORT, () => {
  console.log(`Rooman Alumni API listening on http://localhost:${PORT}`)
})
