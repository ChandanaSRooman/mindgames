import { MailWarning, X } from 'lucide-react'

/**
 * "Please verify your email" prompt, in two sizes: a compact note pinned to
 * the bottom of the left sidebar, and the full banner above the page for when
 * that sidebar isn't on screen (small screens, or collapsed). State lives in
 * AppLayout so dismissing either one hides both.
 */
export function VerifyEmailNotice({
  compact = false,
  resending,
  onResend,
  onDismiss,
}: {
  compact?: boolean
  resending: boolean
  onResend: () => void
  onDismiss: () => void
}) {
  if (compact) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-800">
        <MailWarning size={13} className="mt-px shrink-0" />
        <p className="flex-1">
          Verify your email to keep your account recoverable.{' '}
          <button
            onClick={onResend}
            disabled={resending}
            className="font-semibold text-amber-900 underline hover:no-underline disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend link'}
          </button>
        </p>
        <button onClick={onDismiss} className="shrink-0 rounded-full p-0.5 hover:bg-amber-100" aria-label="Dismiss">
          <X size={11} />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <MailWarning size={16} className="shrink-0" />
      <span className="flex-1">Please verify your email address — it keeps your account recoverable.</span>
      <button
        onClick={onResend}
        disabled={resending}
        className="font-bold text-amber-900 underline hover:no-underline disabled:opacity-50"
      >
        {resending ? 'Sending…' : 'Resend link'}
      </button>
      <button onClick={onDismiss} className="rounded-full p-1 hover:bg-amber-100" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  )
}
