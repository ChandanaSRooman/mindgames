import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { api } from '../lib/api'
import { Button, Card } from '../components/ui'

// Set a new password from the emailed reset link (?token=…).
export function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setError(null)
    setLoading(true)
    try {
      await api.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-[#ff4500]">
          <LockKeyhole size={22} />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-[#1c1c1c]">Set a new password</h1>

        {!token ? (
          <p className="mt-3 text-sm text-[#878a8c]">
            This page needs the link from your reset email.{' '}
            <Link to="/forgot-password" className="font-semibold text-[#ff4500] hover:underline">
              Request a new one
            </Link>
            .
          </p>
        ) : done ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Password updated! Taking you to sign in…
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2.5 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2.5 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Update password
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-[#878a8c]">
          <Link to="/login" className="font-semibold text-[#ff4500] hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
