import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

// Tiny classnames joiner — avoids a dependency.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// ---- Button ----------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: ReactNode
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-teal-500 text-navy-950 hover:bg-teal-400 font-semibold',
  secondary: 'bg-navy-700 text-slate-100 hover:bg-navy-600',
  ghost: 'bg-transparent text-slate-300 hover:bg-navy-800',
  outline: 'border border-navy-600 text-slate-200 hover:bg-navy-800',
}

export function Button({ variant = 'primary', loading, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ---- Card ------------------------------------------------------------------
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-xl border border-navy-700/60 bg-navy-900/60 shadow-lg shadow-black/20', className)}>
      {children}
    </div>
  )
}

// ---- Checkbox --------------------------------------------------------------
export function Checkbox({
  checked,
  onChange,
  indeterminate,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  indeterminate?: boolean
  'aria-label'?: string
}) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked
      }}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-navy-600 bg-navy-800 text-teal-500 accent-teal-500 focus:ring-teal-400"
    />
  )
}

// ---- Spinner ---------------------------------------------------------------
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('animate-spin', className)} />
}
