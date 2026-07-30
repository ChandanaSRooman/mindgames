import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { needsOnboarding, type User } from '../types'
import { isValidEmail } from '../lib/csv'
import { Button, Card } from '../components/ui'

// Sign-in for existing members. Authenticates against the backend (JWT) via the
// store, then lands in the app. Demo account: you@rooman.alumni / roomandemo.
export function Login() {
  const navigate = useNavigate()
  const { login } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Admins land on the console; members with unfinished setup resume the
  // onboarding wizard; everyone else lands on their feed.
  function landingRoute(user: User): string {
    if (user.isAdmin) return '/admin'
    if (needsOnboarding(user)) return '/onboarding'
    return '/home'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')
    setError(null)
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(landingRoute(user))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
      setLoading(false)
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

        <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
          <input className={field} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs font-semibold text-[#ff4500] hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={loading}>
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
