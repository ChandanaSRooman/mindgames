// Hands the password typed at sign-in to the post-invite /set-password screen
// so it doesn't have to ask for it a second time.
//
// Deliberately a module variable rather than router state: `navigate(..., {
// state })` is serialised into window.history.state, which survives a reload
// and a session restore, so a plaintext password would sit in the browser's
// session history. This lives only in the page's JS heap — gone on reload,
// gone on navigation away, never serialised anywhere.
//
// It is read once and cleared, so a later visit to /set-password can't pick
// up a stale value and silently reuse it.

let pending: string | null = null

/** Stash the password just used to sign in. Overwrites any previous value. */
export function setPendingPassword(password: string): void {
  pending = password
}

/** Read and clear it. Returns '' when there's nothing stashed. */
export function takePendingPassword(): string {
  const value = pending ?? ''
  pending = null
  return value
}
