import { Router } from 'express'
import { query } from '../db/pool.js'
import { asyncHandler } from '../http.js'
import { sendInviteEmails, emailEnabled } from '../email.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'

export const invitesRouter = Router()
invitesRouter.use(requireAuth, requireAdmin)

// POST /api/invites/batch — email invites to selected invitees; WhatsApp is
// still simulated. Real email is sent when SMTP is configured (see email.ts).
// Marks invited_at on the invitees that were emailed.
invitesRouter.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const invites: Array<{ id: string; email?: boolean; whatsapp?: boolean }> = req.body?.invites ?? []
    const emailIds = invites.filter((i) => i.email).map((i) => i.id)
    const whatsappCount = invites.filter((i) => i.whatsapp).length

    let recipients: Array<{ name: string; email: string }> = []
    if (emailIds.length) {
      const rows = await query<{ name: string; email: string }>(
        `SELECT name, email FROM invitees WHERE id = ANY($1)`,
        [emailIds],
      )
      recipients = rows.rows
    }

    const emailCount = await sendInviteEmails(recipients)

    if (emailIds.length) {
      await query(`UPDATE invitees SET invited_at = now() WHERE id = ANY($1)`, [emailIds])
    }

    const via = emailEnabled ? 'email' : 'email (simulated)'
    res.json({
      emailCount,
      whatsappCount,
      total: emailCount + whatsappCount,
      message: `Sent ${emailCount} ${via} and ${whatsappCount} WhatsApp (simulated) invitation(s).`,
    })
  }),
)
