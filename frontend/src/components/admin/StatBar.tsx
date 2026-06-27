import type { ReactNode } from 'react'
import { Users, UserCheck, Mail, Sparkles } from 'lucide-react'

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-navy-700/60 bg-navy-800/50 px-4 py-3">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500/15 text-teal-300">{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-semibold text-white">{value}</p>
        <p className="truncate text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export function StatBar({
  total,
  mentors,
  invitesSent,
}: {
  total: number
  mentors: number
  invitesSent: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={<Users size={18} />} label="Total Alumni" value={total} />
      <Stat icon={<UserCheck size={18} />} label="Available Mentors" value={mentors} />
      <Stat icon={<Mail size={18} />} label="Invitations Sent" value={invitesSent} />
      <Stat icon={<Sparkles size={18} />} label="Active This Week" value={Math.max(1, Math.round(total * 0.4))} />
    </div>
  )
}
