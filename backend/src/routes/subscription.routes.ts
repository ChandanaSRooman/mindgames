import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/pool.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'
import { ApiError, asyncHandler } from '../http.js'
import { pushNotification } from '../notify.js'
import {
  PLANS, PLAN_DETAILS, activateSubscription, cancelSubscription,
  getSubscription, recordEvent, type PlanId,
} from '../subscription.js'
import { paymentProvider, parseReference } from '../payments.js'

export const subscriptionRouter = Router()

// GET /api/subscription/plans — the pricing table. Public to any signed-in
// member: a mentee seeing what mentors pay for is harmless, and the mentor
// paywall renders from exactly this.
subscriptionRouter.get(
  '/plans',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const provider = paymentProvider()
    res.json({
      plans: PLANS.map((id) => PLAN_DETAILS[id]),
      payments: { provider: provider.name, live: provider.live },
    })
  }),
)

// GET /api/subscription/me — my own subscription, with the reason I cannot
// accept sessions when that is the case.
subscriptionRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getSubscription(req.user!.sub))
  }),
)

const checkoutSchema = z.object({
  plan: z.enum(PLANS),
  months: z.number().int().min(1).max(12).optional().default(1),
})

// POST /api/subscription/checkout — start paying for a plan.
//
// Records the intent before handing off, so a member who abandons checkout
// still leaves a trail an admin can see. The handoff itself goes through the
// configured provider (see payments.ts) — today that is the stub, which
// takes no money and says so.
subscriptionRouter.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { plan, months } = parsed.data
    if (plan === 'free') throw new ApiError(400, 'The Free plan does not need checkout')

    const me = await query<{ name: string; email: string; is_mentor: boolean }>(
      `SELECT name, email, is_mentor FROM users WHERE id = $1`,
      [req.user!.sub],
    )
    if (!me.rowCount) throw new ApiError(404, 'User not found')
    if (!me.rows[0].is_mentor) {
      throw new ApiError(403, 'Only approved mentors need a plan. Apply to become a mentor first.')
    }

    const session = await paymentProvider().createCheckout({
      userId: req.user!.sub,
      userEmail: me.rows[0].email,
      userName: me.rows[0].name,
      plan,
      months,
    })

    await recordEvent({
      userId: req.user!.sub,
      kind: 'requested',
      plan,
      amount: session.amount,
      provider: session.provider,
      note: `Checkout started for ${plan} x${months}`,
    })

    res.json(session)
  }),
)

// POST /api/subscription/callback — where the gateway (or the stub) reports
// the outcome. Signature-verified; an unverified body is refused outright
// rather than trusted, because this endpoint grants paid access.
//
// Idempotent by the provider's own reference: a gateway that retries the
// same webhook must not grant a second month (see recordEvent).
subscriptionRouter.post(
  '/callback',
  requireAuth,
  asyncHandler(async (req, res) => {
    const reference = typeof req.body?.reference === 'string' ? req.body.reference : ''
    const signature = typeof req.body?.signature === 'string' ? req.body.signature : undefined
    const verified = paymentProvider().verifyCallback(reference, signature)
    if (!verified) throw new ApiError(400, 'Could not verify that payment.')

    // The reference carries the user it was issued for. Refuse if it does
    // not match the caller, so a leaked reference cannot be redeemed by
    // someone else.
    if (verified.userId !== req.user!.sub) throw new ApiError(403, 'That payment reference is not yours.')

    const { state, granted } = await activateSubscription({
      userId: verified.userId,
      plan: verified.plan,
      months: verified.months,
      source: 'gateway',
      provider: paymentProvider().name,
      providerRef: verified.providerRef,
      note: `Activated via ${paymentProvider().name}`,
    })
    // A replayed webhook for the same providerRef is a no-op grant (see
    // activateSubscription) — skip the "your plan is active" notification too,
    // so a retried callback doesn't ping the mentor a second time.
    if (granted) {
      void pushNotification(
        verified.userId,
        'mentorship',
        `Your ${PLAN_DETAILS[verified.plan].name} plan is active — you can accept mentorship sessions now.`,
      )
    }
    res.json(state)
  }),
)

// POST /api/subscription/cancel — stop renewing. Access continues until the
// paid period ends; nothing is clawed back.
subscriptionRouter.post(
  '/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await cancelSubscription(req.user!.sub, 'Cancelled by member'))
  }),
)

// --- Admin -----------------------------------------------------------------

interface AdminRow {
  id: string
  name: string
  email: string
  photo: string | null
  designation: string
  company: string
  is_mentor: boolean
  plan: PlanId | null
  status: string | null
  source: string | null
  expires_at: Date | string | null
  sessions_this_month: number
}

// GET /api/subscription/admin — every mentor and where they stand. Answers
// "who is paying and who is not" in one view, including mentors with no
// subscription row at all (a LEFT JOIN, so they are not silently missing).
subscriptionRouter.get(
  '/admin',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await query<AdminRow>(
      `SELECT u.id, u.name, u.email, u.photo, u.designation, u.company, u.is_mentor,
              s.plan, s.status, s.source, s.expires_at,
              -- COALESCE(accepted_at, created_at), matching getSubscription
              -- exactly. Counting by created_at here meant this column and
              -- the cap the mentor actually hits were two different numbers
              -- under one label: a request sent last month but accepted this
              -- month counts against this month's cap, and admin could not
              -- see why someone was blocked at "3 of 10".
              (SELECT count(*)::int FROM mentorship_sessions ms
                WHERE ms.mentor_id = u.id AND ms.status IN ('upcoming','past')
                  AND COALESCE(ms.accepted_at, ms.created_at) >= date_trunc('month', now())) AS sessions_this_month
         FROM users u
         LEFT JOIN mentor_subscriptions s ON s.user_id = u.id
        WHERE u.is_mentor
        ORDER BY (s.status = 'active') DESC NULLS LAST, u.name`,
    )

    const now = Date.now()
    res.json(
      rows.rows.map((r) => {
        const expires = r.expires_at ? new Date(r.expires_at) : null
        const expired = expires !== null && expires.getTime() < now
        return {
          userId: r.id,
          name: r.name,
          email: r.email,
          photo: r.photo ?? undefined,
          designation: r.designation,
          company: r.company,
          plan: r.plan ?? 'free',
          status: r.status === 'active' && expired ? 'expired' : r.status ?? 'inactive',
          source: r.source ?? 'none',
          expiresAt: expires ? expires.toISOString() : null,
          sessionsThisMonth: r.sessions_this_month,
          // Mirrors getSubscription's rule: a cancelled plan still counts
          // while it has not run out, because cancelling stops the renewal
          // without taking back days already paid for. Deriving this from
          // status alone showed a self-cancelled mentor as "not subscribed"
          // in admin while they were still accepting sessions perfectly well.
          // 'active' keeps its original meaning, including an open-ended
          // admin grant with no expiry at all (expires === null, never
          // expired). 'cancelled' additionally requires a real future end
          // date, matching getSubscription, which treats a cancelled plan
          // with no expiry as simply over.
          subscribed:
            r.status === 'active'
              ? !expired
              : r.status === 'cancelled' && expires !== null && !expired,
        }
      }),
    )
  }),
)

const grantSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(PLANS),
  months: z.number().int().min(1).max(24).optional().default(1),
  note: z.string().trim().max(300).optional(),
})

// POST /api/subscription/admin/grant — comp a plan without payment. The way
// subscriptions are activated until a gateway is wired up, and afterwards
// the way support fixes a failed charge.
subscriptionRouter.post(
  '/admin/grant',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = grantSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message)
    const { userId, plan, months, note } = parsed.data

    const target = await query<{ is_mentor: boolean }>(`SELECT is_mentor FROM users WHERE id = $1`, [userId])
    if (!target.rowCount) throw new ApiError(404, 'User not found')
    if (!target.rows[0].is_mentor) throw new ApiError(400, 'That member is not an approved mentor')

    const { state } = await activateSubscription({
      userId, plan, months, source: 'admin',
      note: note || `Granted by admin for ${months} month(s)`,
    })
    void pushNotification(
      userId,
      'mentorship',
      `You've been given the ${PLAN_DETAILS[plan].name} plan for ${months} month${months > 1 ? 's' : ''}.`,
      req.user!.sub,
    )
    res.json(state)
  }),
)

// POST /api/subscription/admin/revoke — end a plan now.
subscriptionRouter.post(
  '/admin/revoke',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : ''
    if (!userId) throw new ApiError(400, 'userId is required')
    // immediate: an admin revoke ends the paid period too, not just the
    // renewal. A member cancelling their own plan keeps the days they paid
    // for; a revoke is meant to take access away now, as this route says.
    res.json(await cancelSubscription(userId, 'Revoked by admin', { immediate: true }))
  }),
)

// GET /api/subscription/admin/events/:userId — the audit trail for one
// mentor: what was requested, granted, renewed or failed, and when.
subscriptionRouter.get(
  '/admin/events/:userId',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await query<{
      kind: string; plan: string; amount: number | null; provider: string | null
      note: string; created_at: Date | string
    }>(
      `SELECT kind, plan, amount, provider, note, created_at
         FROM subscription_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.userId],
    )
    res.json(
      rows.rows.map((r) => ({
        kind: r.kind,
        plan: r.plan,
        amount: r.amount ?? undefined,
        provider: r.provider ?? undefined,
        note: r.note,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    )
  }),
)

export { parseReference }
