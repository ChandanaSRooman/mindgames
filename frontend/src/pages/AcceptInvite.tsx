import { Navigate, useSearchParams } from 'react-router-dom'

// This app is invite-only. An administrator's invite creates the account and
// emails its sign-in details, linking straight to /login with the address
// pre-filled and locked (see backend/src/email.ts) — so there is nothing for
// anyone to do on this page.
//
// It used to run a self-service sign-up (email a code, verify it, choose a
// password), then an explanation of why that no longer exists. Both were dead
// ends: a visitor with an invite doesn't need them, and a visitor without one
// can't act on them. The route is kept because the landing page and older
// invite emails still link here; it now forwards rather than showing a page
// whose only advice is to go somewhere else.
export function AcceptInvite() {
  const [params] = useSearchParams()
  const email = params.get('email')?.trim()
  // Carry the address through when there is one, so an older invite link
  // still lands on a pre-filled sign-in rather than an empty form.
  return <Navigate to={email ? `/login?email=${encodeURIComponent(email)}` : '/login'} replace />
}
