import { useState } from 'react'
import { ArrowDown, ArrowUp, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import { Button, Card } from '../ui'
import { api } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import type { CareerRoadmap, CareerStage, CareerStageStatus } from '../../types'

type EditableStage = Pick<CareerStage, 'stepKey' | 'title' | 'status' | 'durationWeeks'>

/** The plan is the member's to shape: rename a stage, reorder, drop one that
 *  doesn't apply, pause one, or add their own. Regenerating from the
 *  assessment is a separate action that creates a new version instead. */
export function EditRoadmapPanel({
  roadmap,
  onClose,
  onSaved,
}: {
  roadmap: CareerRoadmap
  onClose: () => void
  onSaved: (r: CareerRoadmap) => void
}) {
  const { notify } = useApp()
  const [stages, setStages] = useState<EditableStage[]>(
    roadmap.stages.map((s) => ({
      stepKey: s.stepKey,
      title: s.title,
      status: s.status,
      durationWeeks: s.durationWeeks,
    })),
  )
  const [saving, setSaving] = useState(false)

  const update = (i: number, patch: Partial<EditableStage>) =>
    setStages((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const move = (i: number, delta: number) =>
    setStages((list) => {
      const next = [...list]
      const target = i + delta
      if (target < 0 || target >= next.length) return list
      ;[next[i], next[target]] = [next[target], next[i]]
      return next
    })

  const remove = (i: number) => setStages((list) => list.filter((_, idx) => idx !== i))

  const add = () =>
    setStages((list) => [
      ...list.slice(0, Math.max(list.length - 1, 0)),
      {
        stepKey: `custom-${Date.now()}`,
        title: 'New stage',
        status: 'upcoming' as CareerStageStatus,
        durationWeeks: 4,
      },
      ...list.slice(Math.max(list.length - 1, 0)),
    ])

  async function save() {
    if (stages.some((s) => !s.title.trim())) {
      notify('Every stage needs a title.', 'error')
      return
    }
    setSaving(true)
    try {
      onSaved(await api.editCareerRoadmap(stages))
      notify('Roadmap updated.', 'success')
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save your roadmap.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1c1c1c]">Edit your roadmap</h2>
          <p className="text-sm text-[#878a8c]">
            Rename, reorder, pause or remove stages. To change your goal, timeline or hours, edit
            your assessment instead — that rebuilds the plan as a new version.
          </p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {stages.map((s, i) => (
          <div key={s.stepKey} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#edeff1] p-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-[#878a8c]">
              {i + 1}
            </span>
            <input
              value={s.title}
              onChange={(e) => update(i, { title: e.target.value })}
              className="min-w-[160px] flex-1 rounded-lg border border-[#edeff1] px-2.5 py-1.5 text-sm outline-none focus:border-[#ff4500]"
            />
            <input
              type="number"
              min={1}
              value={s.durationWeeks ?? ''}
              placeholder="—"
              onChange={(e) =>
                update(i, { durationWeeks: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="w-16 rounded-lg border border-[#edeff1] px-2 py-1.5 text-center text-sm outline-none focus:border-[#ff4500]"
              title="Weeks"
            />
            <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp size={14} />
            </IconBtn>
            <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === stages.length - 1}>
              <ArrowDown size={14} />
            </IconBtn>
            <IconBtn
              label={s.status === 'paused' ? 'Resume stage' : 'Pause stage'}
              onClick={() => update(i, { status: s.status === 'paused' ? 'upcoming' : 'paused' })}
            >
              {s.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
            </IconBtn>
            <IconBtn label="Remove stage" onClick={() => remove(i)} disabled={stages.length === 1}>
              <Trash2 size={14} />
            </IconBtn>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edeff1] pt-4">
        <Button variant="outline" icon={<Plus size={14} />} onClick={add}>
          Add a stage
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save roadmap
          </Button>
        </div>
      </div>
    </Card>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#edeff1] text-[#878a8c] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
