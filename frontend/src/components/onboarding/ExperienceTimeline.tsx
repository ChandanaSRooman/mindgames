import { Briefcase } from 'lucide-react'
import type { Experience } from '../../types'

export function ExperienceTimeline({ items }: { items: Experience[] }) {
  return (
    <ol className="relative ml-2 border-l border-navy-700">
      {items.map((exp, i) => (
        <li key={i} className="mb-6 ml-6 last:mb-0">
          <span className="absolute -left-[11px] grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-navy-950 ring-4 ring-navy-900">
            <Briefcase size={11} />
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h4 className="font-semibold text-slate-100">{exp.role}</h4>
            <span className="text-xs text-slate-400">{exp.period}</span>
          </div>
          <p className="text-sm font-medium text-teal-300">{exp.company}</p>
          <p className="mt-1 text-sm text-slate-400">{exp.summary}</p>
        </li>
      ))}
    </ol>
  )
}
