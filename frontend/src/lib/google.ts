// Google Identity Services (GIS) loader + OAuth token-client wrapper.
// Used by the store's social('google') when the backend reports a configured
// GOOGLE_CLIENT_ID; otherwise the app falls back to the simulated provider.

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClient {
  requestAccessToken: () => void
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string
      scope: string
      callback: (resp: TokenResponse) => void
      error_callback?: (err: { type?: string; message?: string }) => void
    }) => TokenClient
  }
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        gisPromise = null
        reject(new Error('Could not load Google sign-in'))
      }
      document.head.appendChild(script)
    })
  }
  return gisPromise
}

/**
 * Open the Google sign-in popup and resolve with an OAuth access token.
 * Rejects if the user closes the popup or GIS fails to load.
 */
export async function googleSignIn(clientId: string): Promise<string> {
  await loadGis()
  const accounts = window.google?.accounts
  if (!accounts) throw new Error('Google sign-in unavailable')

  return new Promise<string>((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token)
        else reject(new Error(resp.error || 'Google sign-in failed'))
      },
      error_callback: (err) => reject(new Error(err.message || err.type || 'Google sign-in cancelled')),
    })
    client.requestAccessToken()
  })
}
