import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, Rocket, ShieldCheck } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { isValidEmail } from '../lib/csv'
import { Button, Card } from '../components/ui'
import { GoogleIcon, LinkedInIcon } from '../components/icons/Brand'

// Real signup: creates a Postgres-backed account + JWT session via the store,
// then continues to onboarding. Social buttons use simulated OAuth (see backend).

const BENEFITS = [
  { icon: <Briefcase size={18} />, title: 'Paid Mentorship', desc: 'Earn by guiding juniors, or get matched with a senior mentor.' },
  { icon: <Rocket size={18} />, title: 'StartupVarsity Incubation', desc: 'Access incubation support and funding pathways for your ideas.' },
  { icon: <ShieldCheck size={18} />, title: 'Trusted Network', desc: 'A verified community of Rooman alumni and hiring managers.' },
]

export function AcceptInvite() {
  const navigate = useNavigate()
  const { notify, signup, social: socialSignup, googleReady } = useApp()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'google' | 'linkedin' | 'email' | null>(null)

  async function social(provider: 'google' | 'linkedin') {
    setLoading(provider)
    try {
      await socialSignup(provider)
      notify(`Signed up with ${provider === 'google' ? 'Google' : 'LinkedIn'}.`, 'success')
      navigate('/onboarding')
    } catch {
      notify('Sign-up failed. Try again.', 'error')
      setLoading(null)
    }
  }

  async function emailSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return setError('Enter your full name.')
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setError(null)
    setLoading('email')
    try {
      await signup(fullName, email, password)
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Try again.')
      setLoading(null)
    }
  }

  const field =
    'w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2.5 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:outline-none focus:ring-2 focus:ring-orange-100'

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Welcome / benefits */}
        <div className="flex flex-col justify-center px-6 py-12 lg:px-12">
          <div className="mb-6 inline-flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#ff4500] text-white">
              <GraduationCap size={22} />
            </div>
            <span className="text-sm font-semibold text-[#878a8c]">Rooman Alumni Network</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-[#1c1c1c] sm:text-4xl">
            You're invited to join your alumni network.
          </h1>
          <p className="mt-3 max-w-md text-[#878a8c]">
            Reconnect, grow, and give back. Here's what's waiting for you inside.
          </p>
          <div className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-orange-100 text-[#ff4500]">
                  {b.icon}
                </div>
                <div>
                  <p className="font-medium text-[#1c1c1c]">{b.title}</p>
                  <p className="text-sm text-[#878a8c]">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auth card */}
        <div className="flex items-center justify-center px-6 py-12 lg:px-12">
          <Card className="w-full max-w-md p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[#1c1c1c]">Create your account</h2>
            <p className="mt-1 text-sm text-[#878a8c]">Accept your invitation in seconds.</p>

            <div className="mt-6 space-y-3">
              <Button
                variant="subtle"
                className="w-full !bg-white !text-[#1c1c1c] border !border-[#edeff1] hover:!bg-gray-50"
                icon={<GoogleIcon />}
                loading={loading === 'google'}
                onClick={() => social('google')}
              >
                Sign up with Google
              </Button>
              <Button
                variant="subtle"
                className="w-full !bg-white !text-[#1c1c1c] border !border-[#edeff1] hover:!bg-gray-50"
                icon={<LinkedInIcon />}
                loading={loading === 'linkedin'}
                onClick={() => social('linkedin')}
              >
                Sign up with LinkedIn
              </Button>
              {!googleReady && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Social sign-up is in <strong>demo mode</strong> — it uses a shared demo
                  account. To create <em>your own</em> account, use the email form below.
                </p>
              )}
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-[#878a8c]">
              <div className="h-px flex-1 bg-[#edeff1]" />
              OR
              <div className="h-px flex-1 bg-[#edeff1]" />
            </div>

            <form onSubmit={emailSignup} className="space-y-3">
              <input className={field} type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className={field} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={field} type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" loading={loading === 'email'}>
                Create account
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-[#878a8c]">
              By continuing you agree to the network's community guidelines.
            </p>
            <p className="mt-3 text-center text-sm text-[#878a8c]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#ff4500] hover:underline">
                Sign in
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
