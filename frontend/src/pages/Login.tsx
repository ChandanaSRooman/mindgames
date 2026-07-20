import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { needsOnboarding, type User } from '../types'
import { isValidEmail } from '../lib/csv'
import { Button, Card } from '../components/ui'
import { GoogleIcon, LinkedInIcon } from '../components/icons/Brand'

// Sign-in for existing members. Authenticates against the backend (JWT) via the
// store, then lands in the app. Demo account: you@rooman.alumni / roomandemo.
export function Login() {
  const navigate = useNavigate()
  const { notify, login, social: socialLogin, googleReady } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'google' | 'linkedin' | 'email' | null>(null)

  // Admins land on the console; members with unfinished setup resume the
  // onboarding wizard; everyone else lands on their feed.
  function landingRoute(user: User): string {
    if (user.isAdmin) return '/admin'
    if (needsOnboarding(user)) return '/onboarding'
    return '/home'
  }

  async function social(provider: 'google' | 'linkedin') {
    setLoading(provider)
    try {
      const user = await socialLogin(provider)
      navigate(landingRoute(user))
    } catch {
      notify('Sign-in failed. Try again.', 'error')
      setLoading(null)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')
    setError(null)
    setLoading('email')
    try {
      const user = await login(email, password)
      navigate(landingRoute(user))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
      setLoading(null)
    }
  }

  const field =
    'w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2.5 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:outline-none focus:ring-2 focus:ring-orange-100'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#ff4500] text-white">
            <GraduationCap size={22} />
          </span>
          <span className="text-sm font-semibold text-[#878a8c]">Rooman Alumni Network</span>
        </Link>

        <h1 className="text-xl font-semibold text-[#1c1c1c]">Welcome back</h1>
        <p className="mt-1 text-sm text-[#878a8c]">Sign in to your alumni account.</p>

        <div className="mt-6 space-y-3">
          <Button
            variant="subtle"
            className="w-full !bg-white !text-[#1c1c1c] border !border-[#edeff1] hover:!bg-gray-50"
            icon={<GoogleIcon />}
            loading={loading === 'google'}
            onClick={() => social('google')}
          >
            Continue with Google
          </Button>
          <Button
            variant="subtle"
            className="w-full !bg-white !text-[#1c1c1c] border !border-[#edeff1] hover:!bg-gray-50"
            icon={<LinkedInIcon />}
            loading={loading === 'linkedin'}
            onClick={() => social('linkedin')}
          >
            Continue with LinkedIn
          </Button>
          {!googleReady && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Social sign-in is in <strong>demo mode</strong> (shared demo account). Use
              your email and password below to access your own account.
            </p>
          )}
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-[#878a8c]">
          <div className="h-px flex-1 bg-[#edeff1]" />
          OR
          <div className="h-px flex-1 bg-[#edeff1]" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input className={field} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs font-semibold text-[#ff4500] hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={loading === 'email'}>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-[#878a8c]">
          New here?{' '}
          <Link to="/accept-invite" className="font-semibold text-[#ff4500] hover:underline">
            Accept your invite
          </Link>
        </p>
      </Card>
    </div>
  )
}
