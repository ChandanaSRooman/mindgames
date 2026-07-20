import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, MailCheck } from 'lucide-react'
import { api } from '../lib/api'
import { isValidEmail } from '../lib/csv'
import { Button, Card } from '../components/ui'

// Request a password-reset link by email.
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    setError(null)
    setLoading(true)
    try {
      const res = await api.forgotPassword(email)
      setSent(true)
      setDevLink(res.devResetLink ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-[#ff4500]">
          <KeyRound size={22} />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-[#1c1c1c]">Forgot your password?</h1>
        <p className="mt-1 text-sm text-[#878a8c]">
          Enter your sign-in email and we'll send you a link to set a new one.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
              <MailCheck size={16} /> Check your inbox
            </p>
            <p className="mt-1 text-sm text-green-700/80">
              If an account exists for <strong>{email}</strong>, a reset link is on its way. The
              link stays valid for 1 hour.
            </p>
            {devLink && (
              <p className="mt-3 border-t border-green-200 pt-3 text-xs text-[#878a8c]">
                Email isn't configured on this server (dev mode) — use this link directly:{' '}
                <a href={devLink} className="font-semibold text-[#ff4500] underline break-all">
                  open reset link
                </a>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2.5 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-[#878a8c]">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-[#ff4500] hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
