import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { cx } from './index'

const ICON = {
  success: <CheckCircle2 size={18} className="text-teal-400" />,
  error: <XCircle size={18} className="text-rose-400" />,
  info: <Info size={18} className="text-sky-400" />,
}

export function Toaster() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto flex items-start gap-3 rounded-lg border bg-navy-800 px-4 py-3 shadow-xl',
            'animate-[slidein_0.2s_ease-out]',
            t.kind === 'error' ? 'border-rose-500/40' : 'border-navy-600',
          )}
        >
          <span className="mt-0.5 shrink-0">{ICON[t.kind]}</span>
          <p className="flex-1 text-sm text-slate-200">{t.message}</p>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 text-slate-400 hover:text-slate-200"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
