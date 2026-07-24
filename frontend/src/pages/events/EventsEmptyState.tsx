import { Calendar } from 'lucide-react'
import type { ReactNode } from 'react'

export function EventsEmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-[#edeff1] bg-white py-16 text-center shadow-sm">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
        <Calendar size={28} />
      </span>
      <p className="font-semibold text-[#1c1c1c]">{title}</p>
      {children}
    </div>
  )
}
