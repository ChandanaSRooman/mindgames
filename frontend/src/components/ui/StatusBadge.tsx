import type { StatusTag } from '../../types'
import { STATUS_STYLES } from '../../types'
import { cx } from './index'

/** Read-only status pill (used in tables, feed author rows). */
export function StatusBadge({ tag, className }: { tag: StatusTag; className?: string }) {
  const s = STATUS_STYLES[tag]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {tag}
    </span>
  )
}

/** Toggleable status chip (onboarding grid, feed filter). */
export function StatusToggle({
  tag,
  active,
  onToggle,
  className,
}: {
  tag: StatusTag
  active: boolean
  onToggle: () => void
  className?: string
}) {
  const s = STATUS_STYLES[tag]
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cx(
        'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-all',
        active
          ? cx(s.bg, s.text, s.ring, 'ring-2')
          : 'bg-navy-800 text-slate-400 ring-navy-600 hover:text-slate-200 hover:ring-navy-500',
        className,
      )}
    >
      <span className={cx('h-2 w-2 rounded-full', active ? s.dot : 'bg-slate-600')} />
      {tag}
    </button>
  )
}
