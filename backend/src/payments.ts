import { createHmac, timingSafeEqual } from 'node:crypto'
import { PLAN_DETAILS, type PlanId } from './subscription.js'

/**
 * The payment seam.
 *
 * Everything the app needs from a gateway is these three methods. The only
 * implementation today is `stubProvider`, which takes no money and hands back
 * a confirmation page — so the whole journey (paywall -> plan choice ->
 * checkout -> activation) is real and clickable before a gateway exists.
 *
 * Adding Razorpay means writing a second object with the same three methods
 * and setting PAYMENT_PROVIDER=razorpay. Nothing that calls this changes.
 * The parts a real provider needs are already modelled: an order id to hand
 * the client, a signed callback to verify, and idempotency on the provider's
 * own event id (see recordEvent in subscription.ts).
 */

export interface CheckoutRequest {
  userId: string
  userEmail: string
  userName: string
  plan: PlanId
  months: number
}

export interface CheckoutSession {
  /** Our reference, echoed back by the gateway so we can match the callback. */
  reference: string
  provider: string
  amount: number
  currency: 'INR'
  /** Where the client should go next. For a real gateway this is the hosted
   *  checkout URL or the key/order pair its SDK needs. */
  redirectUrl: string
  /** True when no money moved — the client shows a "simulated" notice
   *  instead of pretending a payment succeeded. */
  simulated: boolean
  /** Extra fields a client SDK needs (Razorpay: key, order_id, prefill). */
  clientPayload?: Record<string, unknown>
}

export interface VerifiedPayment {
  reference: string
  providerRef: string
  plan: PlanId
  months: number
  amount: number
  userId: string
}

export interface PaymentProvider {
  readonly name: string
  readonly live: boolean
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>
  /** Verify a callback/webhook body. Returns null when the signature does
   *  not check out — callers must treat null as "ignore this request". */
  verifyCallback(raw: string, signature: string | undefined): VerifiedPayment | null
}

/** Our own reference: <userId>:<plan>:<months>:<nonce>. Carrying the fields
 *  in the reference means a callback can be honoured even if the gateway
 *  gives us nothing else back. */
export function buildReference(userId: string, plan: PlanId, months: number): string {
  const nonce = Math.random().toString(36).slice(2, 10)
  return [userId, plan, String(months), nonce].join(':')
}

export function parseReference(reference: string): { userId: string; plan: PlanId; months: number } | null {
  const [userId, plan, months] = reference.split(':')
  if (!userId || !plan || !months) return null
  if (!(plan in PLAN_DETAILS)) return null
  const n = Number(months)
  if (!Number.isFinite(n) || n < 1) return null
  return { userId, plan: plan as PlanId, months: n }
}

const STUB_SECRET = process.env.PAYMENT_STUB_SECRET || 'dev-stub-secret'

function sign(raw: string, secret: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex')
}

/** Constant-time compare so a wrong signature cannot be guessed a byte at a
 *  time. Length mismatch short-circuits because timingSafeEqual throws. */
export function signaturesMatch(expected: string, given: string | undefined): boolean {
  if (!given) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Takes no money. Produces a real reference and a real signature so the
 * callback path is exercised exactly as it will be with a live gateway —
 * the only difference is that nothing was charged, which `simulated` says
 * plainly so the UI never implies otherwise.
 */
const stubProvider: PaymentProvider = {
  name: 'stub',
  live: false,

  async createCheckout(req) {
    const reference = buildReference(req.userId, req.plan, req.months)
    const amount = (PLAN_DETAILS[req.plan]?.price ?? 0) * req.months
    return {
      reference,
      provider: 'stub',
      amount,
      currency: 'INR',
      // Handled in-app rather than by redirecting off-site.
      redirectUrl: `/subscription/checkout?ref=${encodeURIComponent(reference)}`,
      simulated: true,
      clientPayload: { signature: sign(reference, STUB_SECRET) },
    }
  },

  verifyCallback(raw, signature) {
    if (!signaturesMatch(sign(raw, STUB_SECRET), signature)) return null
    const parsed = parseReference(raw)
    if (!parsed) return null
    return {
      reference: raw,
      providerRef: `stub_${raw}`,
      plan: parsed.plan,
      months: parsed.months,
      amount: (PLAN_DETAILS[parsed.plan]?.price ?? 0) * parsed.months,
      userId: parsed.userId,
    }
  },
}

// PAYMENT_PROVIDER selects the implementation. Only 'stub' exists today;
// adding 'razorpay' here is the single line that switches the app over.
const PROVIDERS: Record<string, PaymentProvider> = { stub: stubProvider }

export function paymentProvider(): PaymentProvider {
  const wanted = process.env.PAYMENT_PROVIDER || 'stub'
  return PROVIDERS[wanted] ?? stubProvider
}

/** Whether real money can move. The UI uses this to decide between "Pay" and
 *  "Simulate payment", so a demo can never look like a real charge. */
export const paymentsAreLive = (): boolean => paymentProvider().live
