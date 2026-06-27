import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { isValidEmail } from '../../lib/csv'
import { Button } from '../ui'

const FIELD = 'w-full rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

export function AddUserForm({
  onAdd,
}: {
  onAdd: (row: { name: string; phone: string; email: string }) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    setError(null)
    void onAdd({ name: name.trim(), phone: phone.trim(), email: email.trim() })
    setName('')
    setPhone('')
    setEmail('')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
        <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Phone Number</label>
        <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98000 00000" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Email ID</label>
        <input className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <Button type="submit" icon={<UserPlus size={16} />} className="w-full">
        Add Alumnus
      </Button>
    </form>
  )
}
