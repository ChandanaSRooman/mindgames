import type pg from 'pg'
import { query, withTransaction } from './db/pool.js'

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
  /** May charge for an event or webinar they host. Free community events are
   *  open to every member and are not affected by any plan. */
  paidEvents: boolean
  /** May host a group session (many mentees, one booking). Free/Mentor stay
   *  1:1 — group sessions are a Pro/Institute capability, same tier that
   *  unlocks unlimited 1:1 sessions in the first place. */
  groupSessions: boolean
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
    paidEvents: false,
    groupSessions: false,
    features: [
      'Appear in the alumni directory',
      'List 1 service',
      'Receive session requests',
      'Host free community events',
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
    paidEvents: true,
    groupSessions: false,
    features: [
      'Accept up to 10 sessions a month',
      'Host paid events and webinars',
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
    paidEvents: true,
    groupSessions: true,
    highlighted: true,
    features: [
      'Unlimited sessions',
      'Host group sessions',
      'Host paid events and webinars',
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
    paidEvents: true,
    groupSessions: true,
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
  /** True when the member currently HAS the plan they paid for — including a
   *  cancelled one that has not run out yet.
   *
   *  Deliberately not the same as canAcceptSessions: a mentor who has used up
   *  the month's cap still has a plan, so the UI must keep showing "Pro plan"
   *  rather than "No active plan". Conversely `status === 'active'` alone is
   *  not enough either, since a cancelled-but-unexpired plan still works. The
   *  UI reads this instead of re-deriving the rule and drifting from it. */
  planActive: boolean
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
    // Counted by when the mentor accepted, not when the mentee asked — a
    // request that sits unaccepted for weeks must not eat a cap month it was
    // never actioned in. accepted_at is only set from the point this column
    // was added; a session that predates it falls back to created_at.
    `SELECT count(*)::int AS n FROM mentorship_sessions
      WHERE mentor_id = $1 AND status IN ('upcoming', 'past')
        AND COALESCE(accepted_at, created_at) >= date_trunc('month', now())`,
    [userId],
  )
  const sessionsThisMonth = used.rows[0]?.n ?? 0

  if (!row) {
    return {
      plan: 'free', status: 'inactive', source: 'none', expiresAt: null,
      canAcceptSessions: false, planActive: false, sessionsThisMonth, sessionsPerMonth: 0,
      blockedReason: 'You need a subscription to accept sessions.',
    }
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at) : null
  const hasExpired = expiresAt !== null && expiresAt.getTime() < Date.now()
  const status = hasExpired && row.status === 'active' ? 'expired' : row.status
  const details = PLAN_DETAILS[row.plan] ?? PLAN_DETAILS.free
  const cap = details.sessionsPerMonth

  // Cancelling stops the renewal, it does not claw back days already paid
  // for — which is what POST /subscription/cancel tells the member happens.
  // Without this a mentor who cancelled on day 2 of a paid month lost the
  // remaining 28 days instantly, and `status` alone could not express
  // "cancelled but still inside the paid period".
  const withinPaidPeriod = expiresAt !== null && expiresAt.getTime() >= Date.now()
  let canAccept = status === 'active' || (status === 'cancelled' && withinPaidPeriod)

  let blockedReason: string | undefined
  if (!canAccept) {
    if (status === 'expired') blockedReason = 'Your plan expired. Renew to keep accepting sessions.'
    else if (status === 'cancelled') blockedReason = 'Your plan was cancelled. Pick one to start again.'
    else blockedReason = 'You need a subscription to accept sessions.'
  } else if (cap !== null && sessionsThisMonth >= cap) {
    // Checked after the grace above, not inside the old `status === 'active'`
    // branch, so a cancelled-but-still-paid mentor is held to the same
    // monthly cap as anyone else rather than slipping past it.
    canAccept = false
    blockedReason = `You've used all ${cap} sessions on the ${details.name} plan this month. Upgrade for more.`
  }

  return {
    plan: row.plan,
    status,
    source: row.source,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    canAcceptSessions: canAccept,
    // Note this is NOT canAccept: a mentor who has used up the month's cap
    // still holds the plan, and the UI must keep saying so.
    planActive: status === 'active' || (status === 'cancelled' && withinPaidPeriod),
    sessionsThisMonth,
    sessionsPerMonth: cap,
    blockedReason,
  }
}

/** Does this member currently have the plan they paid for?
 *
 * 'active' is the ordinary case. 'cancelled' still counts while expires_at is
 * in the future, for the same reason accepting a session does (see
 * getSubscription): cancelling stops the renewal, it does not take back days
 * already paid for. Both capability gates below go through this so a
 * cancelled-but-still-paid mentor cannot end up able to accept a 1:1 session
 * while being refused a group session on the same plan. */
function hasPaidAccess(s: SubscriptionState): boolean {
  return s.planActive
}

/** Whether this member may charge for an event or webinar they host.
 *
 * Only paid events are gated. A free community event stays open to every
 * member, mentor or not — the rule is "monetising through the platform needs
 * a plan", the same rule that gates accepting a paid mentorship session, not
 * "hosting anything needs a plan". Gating all events would have taken an
 * ability students already have. */
export async function canHostPaidEvents(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const s = await getSubscription(userId)
  if (!hasPaidAccess(s)) {
    return { allowed: false, reason: 'Charging for an event needs an active plan. Free events are open to everyone.' }
  }
  if (!PLAN_DETAILS[s.plan]?.paidEvents) {
    return { allowed: false, reason: `The ${PLAN_DETAILS[s.plan].name} plan cannot charge for events. Upgrade to host paid events.` }
  }
  return { allowed: true }
}

/** Whether this member may host a group session right now. Same shape as
 *  canHostPaidEvents: an active plan is necessary but not sufficient — the
 *  plan itself has to include the capability. */
export async function canHostGroupSessions(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const s = await getSubscription(userId)
  if (!hasPaidAccess(s)) {
    return { allowed: false, reason: 'You need a subscription to host group sessions.' }
  }
  if (!PLAN_DETAILS[s.plan]?.groupSessions) {
    return {
      allowed: false,
      reason: `The ${PLAN_DETAILS[s.plan].name} plan doesn't include group sessions. Upgrade to Pro to host one.`,
    }
  }
  return { allowed: true }
}

/** Grant or extend a subscription. One path for every source — an admin
 *  grant, the grandfathering rule and a future gateway callback all land
 *  here, so activation behaves identically however it was triggered.
 *
 *  When `providerRef` is given, the audit-row insert and the grant itself run
 *  in one transaction, with the audit row inserted FIRST: its own unique
 *  index on (provider, provider_ref) is what makes a replayed or
 *  double-submitted gateway callback a no-op. Granting first and logging
 *  second (the previous order) let two concurrent callbacks for the same
 *  payment both pass a separate "already processed?" check before either had
 *  written the row that check relied on — each would then grant its own
 *  month, crediting the mentor twice for one payment. Returns `granted:
 *  false` when this call was such a duplicate, so the caller can skip
 *  re-notifying the mentor. */
export async function activateSubscription(opts: {
  userId: string
  plan: PlanId
  months?: number
  source: SubscriptionState['source']
  provider?: string
  providerRef?: string
  note?: string
}): Promise<{ state: SubscriptionState; granted: boolean }> {
  const months = opts.months ?? 1
  const granted = await withTransaction(async (client) => {
    const inserted = await recordEvent(
      {
        userId: opts.userId,
        kind: 'activated',
        plan: opts.plan,
        // Only a gateway activation involves money, and then it is the whole
        // sum for the period — the matching 'requested' event recorded
        // price x months, so recording one month here made the audit trail
        // read "11988 requested, 999 activated" for one twelve-month purchase.
        //
        // An admin comp takes no payment at all, so it records no amount
        // rather than a list price nobody was charged; a 24-month Institute
        // grant would otherwise post 59,976 to the audit timeline and make
        // comped accounts look like revenue. undefined is bound as NULL by
        // recordEvent and renders as absent in GET /admin/events/:userId.
        amount: opts.source === 'gateway' ? (PLAN_DETAILS[opts.plan]?.price ?? 0) * months : undefined,
        provider: opts.provider,
        providerRef: opts.providerRef,
        note: opts.note ?? '',
      },
      client,
    )
    // No providerRef means this grant has no de-dupe key (admin/grandfather),
    // so there is nothing to conflict on and it always proceeds. With one,
    // a false `inserted` means a previous call already claimed this exact
    // provider_ref — do not grant the month a second time.
    if (opts.providerRef && !inserted) return false
    await client.query(
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
    return true
  })
  return { state: await getSubscription(opts.userId), granted }
}

/** Cancel a subscription. A no-op — no audit event, no error — if the user
 *  has no subscription row or is already cancelled, so an admin revoking a
 *  never-subscribed user doesn't leave a misleading "cancelled" event for a
 *  subscription that never existed. */
export async function cancelSubscription(
  userId: string,
  note = '',
  opts: { immediate?: boolean } = {},
): Promise<SubscriptionState> {
  const immediate = opts.immediate ?? false
  await withTransaction(async (client) => {
    const upd = await client.query(
      // `immediate` also ends the paid period, instead of only stopping the
      // renewal. A member cancelling keeps the days they paid for, but an
      // admin revoke is a moderation action whose route promises to "end a
      // plan now" — without this it would leave the mentor fully able to
      // accept sessions and host paid events until the original expiry, which
      // for a comped 24-month grant is two years of access the admin believed
      // they had just removed.
      //
      // The WHERE lets an immediate revoke also truncate a row that is
      // already 'cancelled' but still inside its paid window — otherwise a
      // member who cancelled first would be permanently un-revokable.
      `UPDATE mentor_subscriptions
          SET status = 'cancelled',
              updated_at = now(),
              expires_at = CASE WHEN $2 THEN now() ELSE expires_at END
        WHERE user_id = $1
          AND (status <> 'cancelled' OR ($2 AND expires_at > now()))`,
      [userId, immediate],
    )
    if (upd.rowCount) await recordEvent({ userId, kind: 'cancelled', plan: 'free', note }, client)
  })
  return getSubscription(userId)
}

/** Append to the audit trail. `providerRef` is unique per provider, so a
 *  gateway replaying the same webhook is silently ignored rather than
 *  granting a second month. Pass `client` to run inside an existing
 *  transaction (see activateSubscription) and get back whether a row was
 *  actually inserted, so the caller can tell a fresh event from a duplicate. */
export async function recordEvent(
  e: {
    userId: string
    kind: 'requested' | 'activated' | 'renewed' | 'cancelled' | 'expired' | 'payment_failed'
    plan: PlanId | 'free'
    amount?: number
    provider?: string
    providerRef?: string
    note?: string
  },
  client?: pg.PoolClient,
): Promise<boolean> {
  const sql = `INSERT INTO subscription_events (user_id, kind, plan, amount, provider, provider_ref, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (provider, provider_ref) WHERE provider_ref IS NOT NULL DO NOTHING`
  const params = [e.userId, e.kind, e.plan, e.amount ?? null, e.provider ?? null, e.providerRef ?? null, e.note ?? '']
  const result = client ? await client.query(sql, params) : await query(sql, params)
  return (result.rowCount ?? 0) > 0
}
