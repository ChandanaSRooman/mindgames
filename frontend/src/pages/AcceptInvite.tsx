import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, Rocket, ShieldCheck, MailCheck, CheckCircle2 } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { api } from '../lib/api'
import { isValidEmail } from '../lib/csv'
import { Button, Card } from '../components/ui'

// Real signup: a three-step, Postgres-backed flow.
//   1. Email  — enter your address; we email a 6-digit code (proves the address
//               is real and correctly typed).
//   2. Verify — enter the code; the backend returns a short-lived signup ticket.
//   3. Details — set your name + password; the account is created from the ticket.
// Email + password are the only sign-up method (no social OAuth).

const BENEFITS = [
  { icon: <Briefcase size={18} />, title: 'Paid Mentorship', desc: 'Earn by guiding juniors, or get matched with a senior mentor.' },
  { icon: <Rocket size={18} />, title: 'StartupVarsity Incubation', desc: 'Access incubation support and funding pathways for your ideas.' },
  { icon: <ShieldCheck size={18} />, title: 'Trusted Network', desc: 'A verified community of Rooman alumni and hiring managers.' },
]

type Step = 'email' | 'code' | 'details'

export function AcceptInvite() {
  const navigate = useNavigate()
  const { signup } = useApp()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'send' | 'verify' | 'create' | null>(null)

  // Step 1 → email a verification code, then move to the code step.
  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    setError(null)
    setLoading('send')
    try {
      const res = await api.signupStart(email.trim())
      setMaskedEmail(res.email)
      setDevCode(res.devCode ?? null)
      setCode('')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.')
    } finally {
      setLoading(null)
    }
  }

  // Step 2 → confirm the code; on success we hold a signup ticket.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length !== 6) return setError('Enter the 6-digit code we emailed you.')
    setError(null)
    setLoading('verify')
    try {
      const res = await api.signupVerify(email.trim(), code.trim())
      setTicket(res.ticket)
      setStep('details')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the code. Try again.')
    } finally {
      setLoading(null)
    }
  }

  // Step 3 → set name + password, create the account from the ticket.
  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return setError('Enter your full name.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setError(null)
    setLoading('create')
    try {
      await signup(ticket, fullName.trim(), password)
      navigate('/onboarding')
    } catch (err) {
      // Ticket expired / already used → send them back to re-verify.
      setError(err instanceof Error ? err.message : 'Sign-up failed. Try again.')
      setLoading(null)
    }
  }

  async function resend() {
    setError(null)
    setLoading('send')
    try {
      const res = await api.signupStart(email.trim())
      setMaskedEmail(res.email)
      setDevCode(res.devCode ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.')
    } finally {
      setLoading(null)
    }
  }

  const field =
    'w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2.5 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:outline-none focus:ring-2 focus:ring-orange-100'

  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {error}
    </p>
  )

  const steps: Step[] = ['email', 'code', 'details']
  const stepIndex = steps.indexOf(step)

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
            {/* Step indicator */}
            <div className="mb-5 flex items-center gap-2">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-[#ff4500]' : 'bg-[#edeff1]'}`}
                />
              ))}
            </div>

            {step === 'email' && (
              <>
                <h2 className="text-xl font-semibold text-[#1c1c1c]">Create your account</h2>
                <p className="mt-1 text-sm text-[#878a8c]">
                  Start with your email — we'll send a code to confirm it's really you.
                </p>
                <form onSubmit={sendCode} className="mt-6 space-y-3" noValidate>
                  <input className={field} type="email" placeholder="Email address" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                  {errorBox}
                  <Button type="submit" className="w-full" loading={loading === 'send'}>
                    Send verification code
                  </Button>
                </form>
              </>
            )}

            {step === 'code' && (
              <>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-orange-100 text-[#ff4500]">
                  <MailCheck size={22} />
                </div>
                <h2 className="mt-3 text-xl font-semibold text-[#1c1c1c]">Verify your email</h2>
                <p className="mt-1 text-sm text-[#878a8c]">
                  Enter the 6-digit code we sent to <span className="font-medium text-[#1c1c1c]">{maskedEmail}</span>.
                </p>

                {devCode && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <strong>Dev/demo mode</strong> — your code is{' '}
                    <span className="font-mono font-semibold tracking-wider">{devCode}</span>{' '}
                    (shown here so you don't have to check email).
                  </p>
                )}

                <form onSubmit={verifyCode} className="mt-6 space-y-3" noValidate>
                  <input
                    className={`${field} text-center text-lg font-semibold tracking-[0.5em]`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    placeholder="••••••"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  {errorBox}
                  <Button type="submit" className="w-full" loading={loading === 'verify'}>
                    Verify
                  </Button>
                </form>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError(null); setCode('') }}
                    className="font-medium text-[#878a8c] hover:text-[#1c1c1c]"
                  >
                    ← Use a different email
                  </button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={loading === 'send'}
                    className="font-semibold text-[#ff4500] hover:underline disabled:opacity-50"
                  >
                    {loading === 'send' ? 'Sending…' : 'Resend code'}
                  </button>
                </div>
              </>
            )}

            {step === 'details' && (
              <>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 size={22} />
                </div>
                <h2 className="mt-3 text-xl font-semibold text-[#1c1c1c]">Email verified</h2>
                <p className="mt-1 text-sm text-[#878a8c]">
                  Almost done — set your name and a password to finish.
                </p>
                <form onSubmit={createAccount} className="mt-6 space-y-3" noValidate>
                  <input className={field} type="text" placeholder="Full name" autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  <input className={field} type="password" placeholder="Password (min 6 chars)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  {errorBox}
                  <Button type="submit" className="w-full" loading={loading === 'create'}>
                    Create account
                  </Button>
                </form>
              </>
            )}

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
