import { config } from './config.js'
import express from 'express'
import cors from 'cors'
import { pool } from './db/pool.js'
import { errorHandler } from './http.js'
import { authRouter } from './routes/auth.routes.js'
import { usersRouter } from './routes/users.routes.js'
import { postsRouter } from './routes/posts.routes.js'
import { connectionsRouter } from './routes/connections.routes.js'
import { messagesRouter } from './routes/messages.routes.js'
import { communitiesRouter } from './routes/communities.routes.js'
import { mentorshipRouter } from './routes/mentorship.routes.js'
import { startupsRouter } from './routes/startups.routes.js'
import { notificationsRouter } from './routes/notifications.routes.js'
import { inviteesRouter } from './routes/invitees.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { invitesRouter } from './routes/invites.routes.js'
import { resumeRouter } from './routes/resume.routes.js'
import { eventsRouter, startEventReminderScheduler } from './routes/events.routes.js'
import { startDigestScheduler } from './digest.js'
import { sseHandler } from './realtime.js'
import { aiRouter } from './routes/ai.routes.js'
import { reportsRouter } from './routes/reports.routes.js'
import { companiesRouter } from './routes/companies.routes.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '15mb' })) // base64 PDFs for resume parsing

// --- Health (also checks DB connectivity) -----------------------------------
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, db: 'up' })
  } catch {
    res.status(503).json({ ok: false, db: 'down' })
  }
})

// --- Feature routers --------------------------------------------------------
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)
app.use('/api/connections', connectionsRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/communities', communitiesRouter)
app.use('/api/mentorship', mentorshipRouter)
app.use('/api/startups', startupsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/alumni', inviteesRouter) // admin invitee directory
app.use('/api/admin', adminRouter) // admin console stats

app.use('/api/invites', invitesRouter)
app.use('/api/resume', resumeRouter)
app.use('/api/events', eventsRouter)
app.get('/api/stream', sseHandler)
app.use('/api/ai', aiRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/companies', companiesRouter)

// --- Terminal error handler -------------------------------------------------
app.use(errorHandler)

startDigestScheduler()
startEventReminderScheduler()

app.listen(config.port, () => {
  console.log(`Rooman Alumni API listening on http://localhost:${config.port}`)
})
