import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { avatarGradient, initials } from '../../lib/format'
import type { PostType, StatusTag } from '../../types'
import { POST_TYPE_STYLES, STATUS_STYLES } from '../../types'

// Tiny classnames joiner (used by Admin components).
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// ---- Avatar ----------------------------------------------------------------
export function Avatar({
  name,
  size = 40,
  to,
}: {
  name: string
  size?: number
  to?: string
}) {
  const inner = (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(
        name,
      )} font-semibold text-white select-none`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials(name)}
    </span>
  )
  if (to) return <Link to={to}>{inner}</Link>
  return inner
}

// ---- Button ----------------------------------------------------------------
type Variant = 'primary' | 'outline' | 'ghost' | 'subtle'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#ff4500] text-white hover:bg-[#ff6534] border border-transparent',
  outline: 'bg-white text-[#ff4500] border border-[#ff4500] hover:bg-orange-50',
  ghost: 'bg-transparent text-[#878a8c] hover:bg-gray-100 border border-transparent',
  subtle: 'bg-gray-100 text-[#1c1c1c] hover:bg-gray-200 border border-transparent',
}

export function Button({
  variant = 'primary',
  className = '',
  icon,
  loading = false,
  children,
  disabled,
  ...rest
}: {
  variant?: Variant
  icon?: ReactNode
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ---- Checkbox (Admin invite table) -----------------------------------------
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  ...rest
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked' | 'type'>) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#ff4500]"
      {...rest}
    />
  )
}

// ---- Status tag badge (Admin directory) ------------------------------------
export function StatusBadge({ tag }: { tag: StatusTag }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[tag]}`}>
      {tag}
    </span>
  )
}

// ---- Card ------------------------------------------------------------------
export function Card({
  children,
  className = '',
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div id={id} className={`rounded-xl border border-[#edeff1] bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ---- Post-type badge -------------------------------------------------------
export function PostTypeBadge({ type }: { type: PostType }) {
  if (type === 'Update') return null
  const s = POST_TYPE_STYLES[type]
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classes}`}>
      {s.label}
    </span>
  )
}

// ---- Generic pill ----------------------------------------------------------
export function Pill({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-[#ff4500] text-white'
          : 'bg-white text-[#878a8c] border border-[#edeff1] hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Section heading -------------------------------------------------------
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">{children}</h2>
  )
}
