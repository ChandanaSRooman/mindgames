import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, Pencil, ShieldCheck } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { api } from '../lib/api'
import { Avatar, Button, Card } from '../components/ui'
import { EditProfileModal } from '../components/profile/EditProfileModal'

export function Settings() {
  const { currentUser, signOut, notify, updateProfile } = useApp()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  // change password form
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const field =
    'w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]'

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 6) return setError('New password must be at least 6 characters.')
    if (next !== confirm) return setError('New passwords do not match.')
    setError(null)
    setSaving(true)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      notify('Password updated. Use it the next time you sign in.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-[#1c1c1c]">Settings</h1>

      {/* Account */}
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
          <ShieldCheck size={18} className="text-[#ff4500]" /> Account
        </h2>
        <div className="flex items-center gap-4">
          <Avatar name={currentUser.name} src={currentUser.photo} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#1c1c1c]">{currentUser.name}</p>
            <p className="truncate text-sm text-[#878a8c]">{currentUser.email}</p>
            <p className="text-xs text-[#878a8c]">
              Batch {currentUser.batchYear} · {currentUser.course || 'Course not set'}
              {currentUser.isAdmin ? ' · Admin' : ''}
            </p>
          </div>
          <Button variant="outline" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        </div>
        <p className="mt-3 text-xs text-[#878a8c]">
          Your email is your sign-in identity and can't be changed here.
        </p>
      </Card>

      {/* Change password */}
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
          <KeyRound size={18} className="text-[#ff4500]" /> Change Password
        </h2>
        <p className="mb-4 text-sm text-[#878a8c]">
          Signed up with Google? Leave the current password empty to set one.
        </p>
        <form onSubmit={changePassword} className="flex max-w-md flex-col gap-3">
          <input
            className={field}
            type="password"
            placeholder="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className={field}
            type="password"
            placeholder="New password (min 6 chars)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className={field}
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="self-start" loading={saving}>
            Update Password
          </Button>
        </form>
      </Card>

      {/* Email preferences */}
      <Card className="p-5">
        <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Email preferences</h2>
        <p className="mb-3 text-sm text-[#878a8c]">
          A short Monday summary of top posts, new jobs and upcoming events.
        </p>
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#edeff1] px-4 py-3">
          <span className="text-sm font-medium text-[#1c1c1c]">Weekly digest email</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#ff4500]"
            checked={currentUser.emailDigest !== false}
            onChange={(e) => updateProfile({ emailDigest: e.target.checked }).catch(() => notify('Could not save your preference.', 'error'))}
          />
        </label>
      </Card>

      {/* Session */}
      <Card className="p-5">
        <h2 className="mb-3 text-base font-bold text-[#1c1c1c]">Session</h2>
        <Button
          variant="outline"
          icon={<LogOut size={15} />}
          onClick={() => {
            signOut()
            navigate('/')
          }}
        >
          Sign out
        </Button>
      </Card>

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </div>
  )
}
