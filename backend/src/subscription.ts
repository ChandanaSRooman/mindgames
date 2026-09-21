import { query } from './db/pool.js'

/**
 * Mentor subscriptions.
 *
 * A mentor needs an active subscription to ACCEPT a session. This gates the
 * supply side only — a mentee's first few sessions stay free (see
 * FREE_MENTORSHIP_SESSIONS in mentorship.routes.ts), which is an unrelated
 * allowance and is not affected by any of this.
 *
 * Why a flat subscription rather than a per-session commission: once the
 * month is paid for, an extra session on the platform costs the mentor
 * nothing, so there is no saving in arranging it privately instead. A
 * commission would create exactly the incentive to go around the platform
 * that the session record is trying to discourage.
 */

export const PLANS = ['free', 'mentor', 'pro', 'institute'] as const
export type PlanId = (typeof PLANS)[number]

export interface Plan {
  id: PlanId
  name: string
  /** Monthly price in whole rupees. */
  price: number
  tagline: string
  /** Sessions the mentor may accept per calendar month; null means no cap. */
  sessionsPerMonth: number | null
  /** Active services they may list; null means no cap. */
  serviceLimit: number | null
  /** Student invites per month. */
  invitesPerMonth: number
  /** Percentage the platform keeps on a paid service. Display-only today. */
  platformFeePct: number
  features: string[]
  /** Drawn as the highlighted column, as on a pricing page. */
  highlighted?: boolean
}

// Keep in sync with PLANS in frontend/src/types.ts.
export const PLAN_DETAILS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Be listed, build your profile',
    sessionsPerMonth: 0,
    serviceLimit: 1,
    invitesPerMonth: 0,
    platformFeePct: 15,
    features: [
      'Appear in the alumni directory',
      'List 1 service',
      'Receive session requests',
      'Accepting a session needs a paid plan',
    ],
  },
  mentor: {
    id: 'mentor',
    name: 'Mentor',
    price: 499,
    tagline: 'For alumni helping a few students',
    sessionsPerMonth: 10,
    serviceLimit: 3,
    invitesPerMonth: 5,
    platformFeePct: 10,
    features: [
      'Accept up to 10 sessions a month',
      'List 3 services',
      'View your mentee’s career roadmap',
      'Invite 5 students a month',
      'Basic insights',
      '10% platform fee on paid services',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 999,
    tagline: 'For alumni who mentor regularly',
    sessionsPerMonth: null,
    serviceLimit: null,
    invitesPerMonth: 25,
    platformFeePct: 5,
    highlighted: true,
    features: [
      'Unlimited sessions',
      'Unlimited services',
      'View your mentee’s career roadmap',
      'Invite 25 students a month',
      'Featured placement in Career Guidance',
      'Full insights and session history',
      '5% platform fee on paid services',
    ],
  },
  institute: {
    id: 'institute',
    name: 'Institute',
    price: 2499,
    tagline: 'For training partners and teams',
    sessionsPerMonth: null,
    serviceLimit: null,
    invitesPerMonth: 1000,
    platformFeePct: 0,
    features: [
      'Everything in Pro',
      'Up to 10 mentors on one account',
      'Unlimited student invites',
      'Priority placement and verified badge',
      'Insights export',
      'No platform fee',
    ],
  },
}

export interface SubscriptionState {
  plan: PlanId
  status: 'inactive' | 'pending' | 'active' | 'expired' | 'cancelled'
  source: 'none' | 'grandfathered' | 'admin' | 'gateway'
  expiresAt: string | null
  /** True when the mentor may accept a session right now. */
  canAcceptSessions: boolean
  /** Sessions accepted this calendar month, against the plan's cap. */
  sessionsThisMonth: number
  sessionsPerMonth: number | null
  /** Why they cannot accept, when they cannot. Shown verbatim to the mentor. */
  blockedReason?: string
}

interface SubRow {
  plan: PlanId
  status: SubscriptionState['status']
  source: SubscriptionState['source']
  expires_at: Date | string | null
}

/** The subscription as it stands right now, with expiry already applied.
 *  An expired row reads as expired here without needing a nightly job. */
export async function getSubscription(userId: string): Promise<SubscriptionState> {
  const r = await query<SubRow>(
    `SELECT plan, status, source, expires_at FROM mentor_subscriptions WHERE user_id = $1`,
    [userId],
  )
  const row = r.rows[0]
  const used = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM mentorship_sessions
      WHERE mentor_id = $1 AND status IN ('upcoming', 'past')
        AND created_at >= date_trunc('month', now())`,
    [userId],
  )
  const sessionsThisMonth = used.rows[0]?.n ?? 0

  if (!row) {
    return {
      plan: 'free', status: 'inactive', source: 'none', expiresAt: null,
      canAcceptSessions: false, sessionsThisMonth, sessionsPerMonth: 0,
      blockedReason: 'Accepting a session needs an active plan.',
    }
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at) : null
  const hasExpired = expiresAt !== null && expiresAt.getTime() < Date.now()
  const status = hasExpired && row.status === 'active' ? 'expired' : row.status
  const details = PLAN_DETAILS[row.plan] ?? PLAN_DETAILS.free
  const cap = details.sessionsPerMonth

  let canAccept = status === 'active'
  let blockedReason: string | undefined
  if (status === 'expired') blockedReason = 'Your plan has expired. Renew to keep accepting sessions.'
  else if (status === 'cancelled') blockedReason = 'Your plan was cancelled. Choose a plan to start again.'
  else if (status !== 'active') blockedReason = 'Accepting a session needs an active plan.'
  else if (cap !== null && sessionsThisMonth >= cap) {
    canAccept = false
    blockedReason = `You've used all ${cap} sessions on the ${details.name} plan this month. Upgrade for more.`
  }

  return {
    plan: row.plan,
    status,
    source: row.source,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    canAcceptSessions: canAccept,
    sessionsThisMonth,
    sessionsPerMonth: cap,
    blockedReason,
  }
}

/** Grant or extend a subscription. One path for every source — an admin
 *  grant, the grandfathering rule and a future gateway callback all land
 *  here, so activation behaves identically however it was triggered. */
export async function activateSubscription(opts: {
  userId: string
  plan: PlanId
  months?: number
  source: SubscriptionState['source']
  provider?: string
  providerRef?: string
  note?: string
}): Promise<SubscriptionState> {
  const months = opts.months ?? 1
  await query(
    `INSERT INTO mentor_subscriptions (user_id, plan, status, source, provider, provider_ref, started_at, expires_at, updated_at)
     VALUES ($1, $2, 'active', $3, $4, $5, now(), now() + ($6 || ' months')::interval, now())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = $2, status = 'active', source = $3, provider = $4, provider_ref = $5,
       started_at = COALESCE(mentor_subscriptions.started_at, now()),
       -- Renewing before expiry extends from the existing end date rather
       -- than from today, so a mentor never loses days by paying early.
       expires_at = GREATEST(COALESCE(mentor_subscriptions.expires_at, now()), now()) + ($6 || ' months')::interval,
       updated_at = now()`,
    [opts.userId, opts.plan, opts.source, opts.provider ?? null, opts.providerRef ?? null, String(months)],
  )
  await recordEvent({
    userId: opts.userId,
    kind: 'activated',
    plan: opts.plan,
    amount: PLAN_DETAILS[opts.plan]?.price ?? 0,
    provider: opts.provider,
    providerRef: opts.providerRef,
    note: opts.note ?? '',
  })
  return getSubscription(opts.userId)
}

export async function cancelSubscription(userId: string, note = ''): Promise<SubscriptionState> {
  await query(
    `UPDATE mentor_subscriptions SET status = 'cancelled', updated_at = now() WHERE user_id = $1`,
    [userId],
  )
  await recordEvent({ userId, kind: 'cancelled', plan: 'free', note })
  return getSubscription(userId)
}

/** Append to the audit trail. `providerRef` is unique per provider, so a
 *  gateway replaying the same webhook is silently ignored rather than
 *  granting a second month. */
export async function recordEvent(e: {
  userId: string
  kind: 'requested' | 'activated' | 'renewed' | 'cancelled' | 'expired' | 'payment_failed'
  plan: PlanId | 'free'
  amount?: number
  provider?: string
  providerRef?: string
  note?: string
}): Promise<void> {
  await query(
    `INSERT INTO subscription_events (user_id, kind, plan, amount, provider, provider_ref, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (provider, provider_ref) WHERE provider_ref IS NOT NULL DO NOTHING`,
    [e.userId, e.kind, e.plan, e.amount ?? null, e.provider ?? null, e.providerRef ?? null, e.note ?? ''],
  )
}
