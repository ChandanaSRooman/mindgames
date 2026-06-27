import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useApp } from '../../store/AppStore'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const ACCENT = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-[#ff4500]',
}

export function Toaster() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className="animate-slidein flex items-start gap-3 rounded-xl border border-[#edeff1] bg-white px-4 py-3 shadow-lg"
          >
            <Icon size={20} className={`mt-0.5 shrink-0 ${ACCENT[t.kind]}`} />
            <p className="flex-1 text-sm text-[#1c1c1c]">{t.message}</p>
            <button onClick={() => dismissToast(t.id)} className="text-[#878a8c] hover:text-[#1c1c1c]">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
