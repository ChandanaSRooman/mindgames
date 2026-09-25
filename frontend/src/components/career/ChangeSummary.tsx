import { ArrowRight, CheckCircle2 } from 'lucide-react'

export interface ChangeRow {
  label: string
  before: string
  after: string
  /** Optional short badge, e.g. the kind of roadmap change. */
  tag?: string
}

/** Renders "what you are about to change" as old → new pairs.
 *
 *  Both career edit flows rewrite something the member already has, so the
 *  screen shows the previous value beside the new one rather than only the
 *  new one — otherwise "Save" asks them to confirm a change they can no
 *  longer see the other half of. */
export function ChangeSummary({
  title = 'What you’re changing',
  hint,
  rows,
  emptyText = 'Nothing changed yet — your plan stays exactly as it is.',
}: {
  title?: string
  hint?: string
  rows: ChangeRow[]
  emptyText?: string
}) {
  return (
    <div className="rounded-xl border border-[#edeff1] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edeff1] px-4 py-3">
        <div>
          <p className="text-sm font-bold text-[#1c1c1c]">{title}</p>
          {hint && <p className="text-xs text-[#878a8c]">{hint}</p>}
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            rows.length > 0 ? 'bg-orange-50 text-[#ff4500]' : 'bg-gray-100 text-[#878a8c]'
          }`}
        >
          {rows.length} {rows.length === 1 ? 'change' : 'changes'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-[#878a8c]">
          <CheckCircle2 size={16} className="shrink-0 text-[#878a8c]" />
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-[#edeff1]">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="px-4 py-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold tracking-wide text-[#1c1c1c] uppercase">{r.label}</p>
                {r.tag && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-[#878a8c] uppercase">
                    {r.tag}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2 text-sm">
                <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-[#878a8c] line-through decoration-[#c9ccce]">
                  {r.before}
                </span>
                <ArrowRight size={14} className="mt-1.5 shrink-0 text-[#878a8c]" />
                <span className="rounded-lg bg-orange-50 px-2.5 py-1 font-semibold text-[#ff4500]">
                  {r.after}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
