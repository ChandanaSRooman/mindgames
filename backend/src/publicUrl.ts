/**
 * Works out the address this server is reachable at, so invite and reset
 * links don't depend on a hand-maintained value.
 *
 * The box has no Elastic IP, so its public address changes on every stop and
 * start. APP_URL is a line in a text file that nothing rewrites, so every
 * email kept pointing at the previous address until someone edited it by
 * hand — twice now, each time discovered only when a recipient reported a
 * dead link.
 *
 * On EC2 the instance can simply ask AWS what its own public address is, via
 * the Instance Metadata Service. Setting APP_URL=auto turns that on, after
 * which a stop/start fixes itself with no deploy and no shell access.
 *
 * An explicit APP_URL still wins, because a deployment behind a domain name
 * or a load balancer must use that name — the raw instance IP would be
 * wrong there, not merely uglier.
 */

const IMDS = 'http://169.254.169.254'

// Deliberately short. Off EC2 this address is simply unroutable, and a long
// timeout would stall startup on a laptop for no reason.
const IMDS_TIMEOUT_MS = 400

async function imds(path: string, token?: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMDS_TIMEOUT_MS)
  try {
    const res = await fetch(`${IMDS}${path}`, {
      method: path === '/latest/api/token' ? 'PUT' : 'GET',
      headers: token
        ? { 'X-aws-ec2-metadata-token': token }
        : { 'X-aws-ec2-metadata-token-ttl-seconds': '60' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = (await res.text()).trim()
    return body || null
  } catch {
    // Not on EC2, IMDS disabled, or blocked — both are normal, not errors.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** This instance's public IPv4 via IMDSv2, or null when unavailable. */
export async function detectPublicIp(): Promise<string | null> {
  const token = await imds('/latest/api/token')
  // IMDSv2 needs the token; IMDSv1 answers without one. Try v2, then v1.
  const ip = await imds('/latest/meta-data/public-ipv4', token ?? undefined)
  if (!ip) return null
  // Guard against a metadata service returning an error page rather than an IP.
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : null
}

let resolved: string | null = null

/** Where the resolved address came from, for logging and the admin console. */
export type BaseUrlSource = 'configured' | 'detected' | 'fallback' | 'default'
let source: BaseUrlSource = 'default'

const DEV_DEFAULT = 'http://localhost:5173'

const clean = (v: string | undefined): string => (v ?? '').trim().replace(/\/+$/, '')

/**
 * The base URL for links in outgoing email, resolved most-explicit first:
 *
 *   1. APP_URL, when it names an address — a domain or load balancer must win,
 *      since this instance's raw IP would be wrong there
 *   2. APP_URL=auto, and the instance's own public IP from EC2 metadata
 *   3. APP_URL_FALLBACK — the address captured at deploy time, used when
 *      detection fails. Without it a metadata failure (endpoint disabled, hop
 *      limit 1, no public IPv4, running in a container) would put localhost
 *      into live reset and verification emails, and the deploy's health check
 *      would still pass because it only ever talks to localhost itself
 *   4. a development default
 *
 * Detection is attempted ONLY for the literal value "auto". An empty or unset
 * APP_URL takes the default, so a staging box with no configuration cannot
 * start advertising its real public IP by accident.
 */
export async function resolveAppBaseUrl(): Promise<string> {
  if (resolved) return resolved

  const configured = clean(process.env.APP_URL)
  const fallback = clean(process.env.APP_URL_FALLBACK)

  if (configured && configured.toLowerCase() !== 'auto') {
    resolved = configured
    source = 'configured'
    return resolved
  }

  if (configured.toLowerCase() === 'auto') {
    const ip = await detectPublicIp()
    if (ip) {
      resolved = `http://${ip}`
      source = 'detected'
      return resolved
    }
    // Loud, because every link in every email is now wrong-by-default until
    // someone notices, and nothing downstream will fail to draw attention.
    if (fallback) {
      resolved = fallback
      source = 'fallback'
      console.error(
        `APP_URL=auto but EC2 instance metadata was unreachable — using APP_URL_FALLBACK ` +
          `(${resolved}) for email links. Detection retries on the next restart.`,
      )
      return resolved
    }
    resolved = DEV_DEFAULT
    source = 'default'
    console.error(
      `APP_URL=auto but EC2 instance metadata was unreachable and APP_URL_FALLBACK is unset — ` +
        `email links will point at ${resolved}, which is almost certainly wrong outside local ` +
        `development. Set APP_URL to a fixed address, or APP_URL_FALLBACK as a safety net.`,
    )
    return resolved
  }

  // Unset or empty: take the default rather than probing metadata.
  resolved = fallback || DEV_DEFAULT
  source = fallback ? 'fallback' : 'default'
  return resolved
}

/** Where the value in force came from. Exposed in the admin console. */
export const baseUrlSource = (): BaseUrlSource => source

/** Test seam: forget the cached value so the next call re-resolves. */
export function resetResolvedBaseUrl(): void {
  resolved = null
  source = 'default'
}
