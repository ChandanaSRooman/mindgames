import { Filter, X } from 'lucide-react'
import type { StatusTag } from '../../types'
import { STATUS_TAGS } from '../../types'
import { Card } from '../ui'
import { StatusToggle } from '../ui/StatusBadge'

export function StatusFilterSidebar({
  active,
  onToggle,
  onClear,
}: {
  active: StatusTag[]
  onToggle: (t: StatusTag) => void
  onClear: () => void
}) {
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Filter size={16} className="text-teal-300" />
        <h3 className="text-sm font-semibold text-white">Filter by status</h3>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Find talent or mentors. Shows posts whose author has any selected status.
      </p>
      <div className="flex flex-wrap gap-2">
        {STATUS_TAGS.map((t) => (
          <StatusToggle key={t} tag={t} active={active.includes(t)} onToggle={() => onToggle(t)} />
        ))}
      </div>
      {active.length > 0 && (
        <button
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <X size={13} /> Clear filters
        </button>
      )}
    </Card>
  )
}
