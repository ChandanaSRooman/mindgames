import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Link2, Plus, Trash2, X } from 'lucide-react'
import { Button, Card } from '../ui'
import { api } from '../../lib/api'
import { isSharedWithMe } from '../../lib/careerResources'
import { useApp } from '../../store/AppStore'
import type { CareerResource, CareerResourceKind } from '../../types'

/**
 * Resources shared inside one mentorship session.
 *
 * Both parties can add: a mentor hands over "read this before we meet", a
 * mentee hands back what they found. Whoever saved a resource owns it, so
 * only they can delete it — the server refuses either way, and showing a
 * delete button that always fails would be worse than not showing one.
 *
 * The same rows also appear on the member's Learning Resources page, because
 * a resource shared into a session is visible to both parties to it. This
 * modal is just the session-shaped view of that list.
 */

const KINDS: CareerResourceKind[] = ['article', 'video', 'course', 'book', 'doc', 'other']

export function SessionResourcesModal({
  sessionId,
  topic,
  onClose,
}: {
  sessionId: string
  topic: string
  onClose: () => void
}) {
  const { currentUser } = useApp()
  const [items, setItems] = useState<CareerResource[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<CareerResourceKind>('article')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await api.getCareerResources(sessionId))
    } catch {
      setError('Could not load what was shared here.')
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
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
        kind,
        sessionId,
      })
      setItems((prev) => [created, ...prev])
      setTitle('')
      setUrl('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share that resource.')
    }
    setSaving(false)
  }

  const remove = async (r: CareerResource) => {
    setItems((prev) => prev.filter((x) => x.id !== r.id))
    try {
      await api.deleteCareerResource(r.id)
    } catch {
      setError('Could not remove that resource.')
      void load()
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1c1c1c]">Shared resources</h2>
            <p className="truncate text-sm text-[#878a8c]">{topic}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#edeff1] p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Read this before we meet"
            aria-label="Resource title"
            className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Link (optional)"
              aria-label="Resource link"
              className="min-w-0 flex-1 rounded-lg border border-[#edeff1] px-3 py-2 text-sm"
            />
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
          </div>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button icon={<Plus size={14} />} loading={saving} onClick={() => void add()}>
              Share
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {loading && <p className="text-sm text-[#878a8c]">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="py-4 text-center text-sm text-[#878a8c]">
              Nothing shared here yet. Anything you add shows up for both of you, and on your
              Learning resources page.
            </p>
          )}
          {items.map((r) => {
            const mine = !isSharedWithMe(r, currentUser.id)
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-lg border border-[#edeff1] p-3"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-50 text-[#878a8c]">
                  <Link2 size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#1c1c1c] hover:text-[#ff4500] hover:underline"
                    >
                      {r.title}
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-[#1c1c1c]">{r.title}</span>
                  )}
                  <p className="mt-0.5 text-[11px] text-[#878a8c]">
                    {mine ? 'Shared by you' : `Shared by ${r.ownerName ?? 'them'}`}
                  </p>
                </div>
                {mine && (
                  <button
                    onClick={() => void remove(r)}
                    aria-label={`Remove ${r.title}`}
                    className="rounded-full p-1.5 text-[#878a8c] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    </div>
  )
}
