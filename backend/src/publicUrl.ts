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

/**
 * The base URL for links in outgoing email.
 *
 * APP_URL wins unless it is literally "auto", in which case the instance's
 * own public IP is used. Resolved once and remembered: the address cannot
 * change without the process restarting, and a restart re-resolves it.
 */
export async function resolveAppBaseUrl(): Promise<string> {
  if (resolved) return resolved
  const configured = (process.env.APP_URL ?? '').trim().replace(/\/+$/, '')

  if (configured && configured.toLowerCase() !== 'auto') {
    resolved = configured
    return resolved
  }

  const ip = await detectPublicIp()
  if (ip) {
    resolved = `http://${ip}`
    console.log(`APP_URL=auto — detected public address ${resolved}`)
    return resolved
  }

  resolved = configured && configured.toLowerCase() !== 'auto' ? configured : 'http://localhost:5173'
  console.warn(
    `APP_URL=auto but the instance metadata service was unreachable — falling back to ${resolved}. ` +
      `Email links will use that address.`,
  )
  return resolved
}

/** Test seam: forget the cached value so the next call re-resolves. */
export function resetResolvedBaseUrl(): void {
  resolved = null
}
