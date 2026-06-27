import { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function SkillsPills({
  skills,
  onChange,
}: {
  skills: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (v && !skills.some((s) => s.toLowerCase() === v.toLowerCase())) onChange([...skills, v])
    setDraft('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="group inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 py-1 pl-3 pr-1.5 text-sm font-medium text-teal-200 ring-1 ring-teal-500/30"
          >
            {skill}
            <button
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              className="grid h-4 w-4 place-items-center rounded-full text-teal-300/70 hover:bg-teal-500/30 hover:text-teal-100"
              aria-label={`Remove ${skill}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-sm text-slate-500">No skills yet — add some below.</p>}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add a skill…"
          className="flex-1 rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button
          onClick={add}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-700 text-slate-200 hover:bg-navy-600"
          aria-label="Add skill"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}
