import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, Rocket, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { isValidEmail } from '../lib/csv'
import { Button, Card } from '../components/ui'
import { GoogleIcon, LinkedInIcon } from '../components/icons/Brand'

const BENEFITS = [
  { icon: <Briefcase size={18} />, title: 'Paid Mentorship', desc: 'Earn by guiding juniors, or get matched with a senior mentor.' },
  { icon: <Rocket size={18} />, title: 'StartupVarsity Incubation', desc: 'Access incubation support and funding pathways for your ideas.' },
  { icon: <ShieldCheck size={18} />, title: 'Trusted Network', desc: 'A verified community of Rooman alumni and hiring managers.' },
]

export function AcceptInvite() {
  const navigate = useNavigate()
  const { notify, signIn } = useApp()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'google' | 'linkedin' | 'email' | null>(null)

  async function social(provider: 'google' | 'linkedin') {
    setLoading(provider)
    try {
      await api.social(provider)
      signIn(provider)
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
      await api.signup(email, password)
      signIn('email', email, fullName)
      navigate('/onboarding')
    } catch {
      notify('Sign-up failed. Try again.', 'error')
      setLoading(null)
    }
  }

  const field =
    'w-full rounded-lg border border-navy-600 bg-navy-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Welcome / benefits */}
        <div className="flex flex-col justify-center px-6 py-12 lg:px-12">
          <div className="mb-6 inline-flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500 text-navy-950">
              <GraduationCap size={22} />
            </div>
            <span className="text-sm font-semibold text-slate-300">Rooman Alumni Network</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
            You're invited to join your alumni network.
          </h1>
          <p className="mt-3 max-w-md text-slate-400">
            Reconnect, grow, and give back. Here's what's waiting for you inside.
          </p>
          <div className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-500/15 text-teal-300">
                  {b.icon}
                </div>
                <div>
                  <p className="font-medium text-slate-100">{b.title}</p>
                  <p className="text-sm text-slate-400">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auth card */}
        <div className="flex items-center justify-center px-6 py-12 lg:px-12">
          <Card className="w-full max-w-md p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Create your account</h2>
            <p className="mt-1 text-sm text-slate-400">Accept your invitation in seconds.</p>

            <div className="mt-6 space-y-3">
              <Button
                variant="outline"
                className="w-full bg-white !text-navy-900 hover:bg-slate-100"
                icon={<GoogleIcon />}
                loading={loading === 'google'}
                onClick={() => social('google')}
              >
                Sign up with Google
              </Button>
              <Button
                variant="outline"
                className="w-full bg-white !text-navy-900 hover:bg-slate-100"
                icon={<LinkedInIcon />}
                loading={loading === 'linkedin'}
                onClick={() => social('linkedin')}
              >
                Sign up with LinkedIn
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px flex-1 bg-navy-700" />
              OR
              <div className="h-px flex-1 bg-navy-700" />
            </div>

            <form onSubmit={emailSignup} className="space-y-3">
              <input className={field} type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className={field} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={field} type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <Button type="submit" className="w-full" loading={loading === 'email'}>
                Create account
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              By continuing you agree to the network's community guidelines.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
