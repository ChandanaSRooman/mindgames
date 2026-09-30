import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Book,
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Link2,
  Lock,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { Button, Card } from '../ui'
import { api } from '../../lib/api'
import { doneCount, groupByStage, isSharedWithMe } from '../../lib/careerResources'
import { useApp } from '../../store/AppStore'
import type {
  CareerResource,
  CareerResourceKind,
  CareerResourceStatus,
  CareerRoadmap,
} from '../../types'

/**
 * The member's learning resources, grouped under the roadmap stage each one
 * serves.
 *
 * Renders on its own route rather than as a tab: CareerGuidance has no tab
 * bar, and the established pattern for this feature is a sub-page reached
 * from the header (see ManageServicesPage, EditRoadmapPage).
 */

const KIND_ICON: Record<CareerResourceKind, typeof BookOpen> = {
  article: FileText,
  video: Video,
  course: GraduationCap,
  book: Book,
  doc: BookOpen,
  other: Link2,
}

const KINDS: CareerResourceKind[] = ['article', 'video', 'course', 'book', 'doc', 'other']

const STATUS_LABEL: Record<CareerResourceStatus, string> = {
  saved: 'Saved',
  in_progress: 'Learning',
  done: 'Done',
}

const STATUS_STYLE: Record<CareerResourceStatus, string> = {
  saved: 'bg-gray-100 text-[#878a8c]',
  in_progress: 'bg-orange-50 text-[#ff4500]',
  done: 'bg-green-50 text-green-700',
}

export function LearningResourcesPanel() {
  const { currentUser } = useApp()
  const [resources, setResources] = useState<CareerResource[]>([])
  const [roadmap, setRoadmap] = useState<CareerRoadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [list, plan] = await Promise.all([api.getCareerResources(), api.getCareerRoadmap()])
    setResources(list)
    setRoadmap(plan)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Grouped against the ACTIVE roadmap, so a resource saved against an
  // earlier version of the plan falls into "Other resources" rather than
  // silently claiming a same-named stage in the current one.
  const groups = useMemo(
    () => groupByStage(resources, roadmap?.stages ?? [], roadmap?.roadmapId ?? ''),
    [resources, roadmap],
  )

  const setStatus = async (r: CareerResource, status: CareerResourceStatus) => {
    setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))
    try {
      await api.updateCareerResource(r.id, { status })
    } catch {
      setError('Could not save that change.')
      void load()
    }
  }

  const setVisibility = async (r: CareerResource, isPublic: boolean) => {
    setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, isPublic } : x)))
    try {
      await api.updateCareerResource(r.id, { isPublic })
    } catch {
      setError('Could not change who can see that.')
      void load()
    }
  }

  const remove = async (r: CareerResource) => {
    setResources((prev) => prev.filter((x) => x.id !== r.id))
    try {
      await api.deleteCareerResource(r.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that resource.')
      void load()
    }
  }

  if (loading) return <Card className="p-5 text-sm text-[#878a8c]">Loading your resources…</Card>

  const done = doneCount(resources)

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-bold text-[#1c1c1c]">
            {resources.length} {resources.length === 1 ? 'resource' : 'resources'}
            {resources.length > 0 && (
              <span className="ml-2 font-medium text-[#878a8c]">{done} done</span>
            )}
          </p>
          <p className="text-xs text-[#878a8c]">
            Articles, videos and courses you are learning from — yours, and anything shared with
            you in a session.
          </p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add resource'}
        </Button>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card>
      )}

      {adding && roadmap && (
        <AddResourceForm
          roadmap={roadmap}
          onCancel={() => setAdding(false)}
          onSaved={(created) => {
            setResources((prev) => [created, ...prev])
            setAdding(false)
          }}
        />
      )}

      {/* No roadmap yet is a real state — a member can save resources before
          building a plan, they just all land in the catch-all group. */}
      {adding && !roadmap && (
        <AddResourceForm
          roadmap={null}
          onCancel={() => setAdding(false)}
          onSaved={(created) => {
            setResources((prev) => [created, ...prev])
            setAdding(false)
          }}
        />
      )}

      {groups.length === 0 && !adding && (
        <Card className="px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
            <BookOpen size={22} />
          </span>
          <h2 className="mt-3 text-base font-bold text-[#1c1c1c]">Nothing saved yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#878a8c]">
            Save an article, video or course for a stage of your roadmap and it will show up
            here — along with anything a mentor shares with you in a session.
          </p>
        </Card>
      )}

      {groups.map((g) => (
        <Card key={g.stepKey ?? '__unsorted'} className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1c1c1c]">{g.title}</h2>
            <span className="text-xs text-[#878a8c]">
              {doneCount(g.resources)} of {g.resources.length} done
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {g.resources.map((r) => (
              <ResourceRow
                key={r.id}
                resource={r}
                mine={!isSharedWithMe(r, currentUser.id)}
                onStatus={(s) => void setStatus(r, s)}
                onVisibility={(pub) => void setVisibility(r, pub)}
                onDelete={() => void remove(r)}
              />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function ResourceRow({
  resource,
  mine,
  onStatus,
  onVisibility,
  onDelete,
}: {
  resource: CareerResource
  /** Only the owner gets the status control and the delete button — the
   *  server refuses either way, so showing them would only produce an error. */
  mine: boolean
  onStatus: (status: CareerResourceStatus) => void
  onVisibility: (isPublic: boolean) => void
  onDelete: () => void
}) {
  const Icon = KIND_ICON[resource.kind] ?? Link2

  return (
    <li className="flex items-start gap-3 rounded-lg border border-[#edeff1] p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-50 text-[#878a8c]">
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#1c1c1c] hover:text-[#ff4500] hover:underline"
            >
              {resource.title}
              <ExternalLink size={11} />
            </a>
          ) : (
            <span className="text-sm font-semibold text-[#1c1c1c]">{resource.title}</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[resource.status]}`}
          >
            {STATUS_LABEL[resource.status]}
          </span>
        </div>

        {resource.note && <p className="mt-1 text-xs text-[#878a8c]">{resource.note}</p>}

        {/* Only worth saying when it did not come from you. */}
        {!mine && (
          <p className="mt-1 text-[11px] text-[#878a8c]">
            Shared by <span className="font-semibold">{resource.ownerName ?? 'your mentor'}</span>
            {resource.sessionTopic ? ` · ${resource.sessionTopic}` : ''}
          </p>
        )}
        {mine && resource.sessionTopic && (
          <p className="mt-1 text-[11px] text-[#878a8c]">Shared in · {resource.sessionTopic}</p>
        )}
      </div>

      {mine && (
        <div className="flex shrink-0 items-center gap-1">
          {/* Visibility toggle — independent of status, and independent of
              whatever stage/session this resource is also tied to. Those
              links never become visible to anyone else just because this is
              public; only the recommendation itself does. */}
          <button
            onClick={() => onVisibility(resource.isPublic ? false : true)}
            title={resource.isPublic ? 'Showing on your profile — click to hide it again' : 'Only you can see this — click to show it on your profile'}
            aria-label={resource.isPublic ? 'Stop showing on profile' : 'Show on profile'}
            className={`rounded-full p-1.5 ${resource.isPublic ? 'text-[#ff4500]' : 'text-[#878a8c]'} hover:bg-gray-100`}
          >
            {resource.isPublic ? <Globe size={13} /> : <Lock size={13} />}
          </button>
          <select
            value={resource.status}
            onChange={(e) => onStatus(e.target.value as CareerResourceStatus)}
            aria-label={`Status of ${resource.title}`}
            className="rounded-lg border border-[#edeff1] px-2 py-1 text-[11px] text-[#1c1c1c]"
          >
            {(Object.keys(STATUS_LABEL) as CareerResourceStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {/* A finished session's resources are a record — the server refuses
              the delete, so the button would only ever fail. */}
          {!resource.sessionLocked && (
            <button
              onClick={onDelete}
              aria-label={`Delete ${resource.title}`}
              className="rounded-full p-1.5 text-[#878a8c] hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function AddResourceForm({
  roadmap,
  onCancel,
  onSaved,
}: {
  roadmap: CareerRoadmap | null
  onCancel: () => void
  onSaved: (created: CareerResource) => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<CareerResourceKind>('article')
  const [stepKey, setStepKey] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The bookend stages are not work — the first is where the member already
  // was and the last is the goal — so neither is offered as somewhere to file
  // a resource, matching the timeline's own completion controls.
  const stages = (roadmap?.stages ?? []).slice(1, -1)

  const submit = async () => {
    if (!title.trim()) {
      setError('Give it a title.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const created = await api.createCareerResource({
        title: title.trim(),
        url: url.trim() || undefined,
        note: note.trim() || undefined,
        kind,
        isPublic,
        // Sent as a pair or not at all — the server rejects a stage without
        // its roadmap, because a step key alone cannot be stored coherently.
        ...(stepKey && roadmap ? { roadmapId: roadmap.roadmapId, stepKey } : {}),
      })
      onSaved(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that resource.')
      setSaving(false)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-[#1c1c1c]">Add a resource</h2>
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. AWS VPC deep dive"
          aria-label="Resource title"
          className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (optional)"
          aria-label="Resource link"
          className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — why this one?"
          aria-label="Resource note"
          rows={2}
          className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CareerResourceKind)}
            aria-label="Resource type"
            className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
          {stages.length > 0 && (
            <select
              value={stepKey}
              onChange={(e) => setStepKey(e.target.value)}
              aria-label="Roadmap stage"
              className="min-w-0 flex-1 rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
            >
              <option value="">No particular stage</option>
              {stages.map((s) => (
                <option key={s.stepKey} value={s.stepKey}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#1c1c1c]">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Show this on my profile
          <span className="text-[#878a8c]">— others can see the title and link, but not which stage it's for.</span>
        </label>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            Save resource
          </Button>
        </div>
      </div>
    </Card>
  )
}
