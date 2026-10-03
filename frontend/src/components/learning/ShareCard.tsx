import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  Bookmark, BookmarkCheck, Clock, ExternalLink, FileText, Flag, HandHeart, Link2, MessageSquare, Trash2, X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { roleLine } from '../../lib/format'
import { KIND_LABEL, displayLink, helpedByLabel } from '../../lib/learningHub'
import { useApp } from '../../store/AppStore'
import { useLayout } from '../layout/LayoutContext'
import { Avatar } from '../ui'
import type { LearningShare } from '../../types'
import { KindBadge, KindIcon } from './KindIcon'

const DIFFICULTY: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

/**
 * One thing an alum shared — the page's whole unit.
 *
 * The person comes first, because that is what makes this different from a
 * list of links: their name, what they do, and their own sentence on why it
 * helped them. Then the thing itself, then the two ways to act on it — keep it
 * (Save), tell them it landed (Helped me), or ask them about it (Ask).
 *
 * Every button is one small write. The card updates at once and puts the old
 * values back if the request fails, so a click never waits on the network.
 */
export function ShareCard({
  share,
  onChange,
  onRemoved,
  onSavedChange,
  mine = false,
}: {
  share: LearningShare
  onChange: (next: LearningShare) => void
  /** Hidden by reports, or deleted by its own author. */
  onRemoved?: (id: string) => void
  /** The viewer shared this: they get Delete instead of Helped/Ask. */
  mine?: boolean
  /** +1 / -1 once the server has confirmed a save or unsave, so the
   *  sidebar's "N saved" follows without re-reading the page. */
  onSavedChange?: (delta: 1 | -1) => void
}) {
  const { notify } = useApp()
  const { openChatWith } = useLayout()
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const saved = !!share.mySavedResourceId
  const isProject = share.kind === 'project'

  const toggleSave = async () => {
    if (busy) return
    setBusy(true)
    const before = share
    onChange({
      ...share,
      mySavedResourceId: saved ? null : 'pending',
      savedCount: Math.max(0, share.savedCount + (saved ? -1 : 1)),
    })
    try {
      if (saved) {
        const r = await api.unsaveShare(share.id)
        onChange({ ...before, mySavedResourceId: null, savedCount: r.savedCount })
        onSavedChange?.(-1)
      } else {
        const r = await api.saveShare(share.id)
        onChange({ ...before, mySavedResourceId: r.savedResourceId, savedCount: r.savedCount })
        onSavedChange?.(1)
        notify('Saved — find it in Saved Resources.')
      }
    } catch (e) {
      onChange(before)
      notify(e instanceof Error ? e.message : 'Could not save that.', 'error')
    }
    setBusy(false)
  }

  const toggleHelped = async () => {
    if (busy) return
    setBusy(true)
    const before = share
    onChange({
      ...share,
      iHelped: !share.iHelped,
      helpedCount: Math.max(0, share.helpedCount + (share.iHelped ? -1 : 1)),
    })
    try {
      const r = share.iHelped ? await api.unmarkShareHelped(share.id) : await api.markShareHelped(share.id)
      onChange({ ...before, iHelped: r.iHelped, helpedCount: r.helpedCount })
      if (r.iHelped) notify(`${share.sharedBy.name} has been told it helped you.`)
    } catch (e) {
      onChange(before)
      notify(e instanceof Error ? e.message : 'Could not do that.', 'error')
    }
    setBusy(false)
  }

  const report = async () => {
    if (!window.confirm('Report this as broken or unhelpful? It is hidden once a few members report it.')) return
    try {
      const r = await api.reportShare(share.id)
      notify('Thanks — reported.')
      if (r.hidden) onRemoved?.(share.id)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not report that.', 'error')
    }
  }

  const remove = async () => {
    if (!window.confirm('Remove this from the network? Members who saved it keep their own copy.')) return
    try {
      await api.deleteShare(share.id)
      onRemoved?.(share.id)
      notify('Removed.')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not remove that.', 'error')
    }
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-[#edeff1] bg-white p-3.5 shadow-sm">
      {/* The person, first. */}
      <div className="flex items-start gap-2.5">
        <Avatar name={share.sharedBy.name} size={36} to={`/profile/${share.sharedBy.id}`} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/profile/${share.sharedBy.id}`}
            className="block truncate text-xs font-bold text-[#1c1c1c] hover:underline"
          >
            {share.sharedBy.name}
            {share.sharedBy.isMentor && <span className="ml-1 text-[10px] font-semibold text-[#ff4500]">Mentor</span>}
          </Link>
          <p className="truncate text-[11px] text-[#878a8c]">{roleLine(share.sharedBy)}</p>
        </div>
        <KindBadge kind={share.kind} label={KIND_LABEL[share.kind] ?? 'Link'} />
      </div>

      {share.hidden && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
          Hidden after members reported it — no longer shown to others.
        </p>
      )}

      {/* Their reason — the recommendation itself. */}
      <p className="mt-2.5 line-clamp-3 text-xs italic text-[#1c1c1c]">“{share.whyHelped}”</p>

      {/* The thing. */}
      <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-gray-50 p-2">
        <KindIcon kind={share.kind} size={30} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-bold text-[#1c1c1c]">{share.title}</p>
          {share.url && (
            <p className="flex min-w-0 items-center gap-1 text-[10px] text-[#878a8c]">
              <Link2 size={9} className="shrink-0" />
              <span className="truncate">{displayLink(share.url)}</span>
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#878a8c]">
            <span className="rounded-full bg-white px-1.5 py-0.5 font-semibold">{DIFFICULTY[share.difficulty]}</span>
            {isProject && share.estHours != null && (
              <span className="inline-flex items-center gap-0.5">
                <Clock size={9} /> ~{share.estHours}h
              </span>
            )}
          </p>
        </div>
      </div>
      {share.skills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {share.skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] text-[#1c1c1c]">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#878a8c]">
          <span>{helpedByLabel(share.helpedCount)}</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => void toggleSave()}
              disabled={busy || share.hidden}
              aria-pressed={saved}
              aria-label={saved ? `Unsave ${share.title}` : `Save ${share.title}`}
              title={saved ? 'In Saved Resources' : 'Save to Saved Resources'}
              className={`rounded-full p-1 hover:bg-gray-50 ${saved ? 'text-[#ff4500]' : ''}`}
            >
              {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>
            {mine ? (
              <button
                onClick={() => void remove()}
                aria-label={`Remove ${share.title}`}
                title="Remove from the network"
                className="rounded-full p-1 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <button
                onClick={() => void report()}
                aria-label={`Report ${share.title}`}
                title="Report a broken or unhelpful share"
                className="rounded-full p-1 text-[#c4c6c8] hover:bg-gray-50 hover:text-red-500"
              >
                <Flag size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-1.5">
          {/* A brief's written problem statement opens in place; a link opens
              in a new tab. A brief can have both — the statement comes first. */}
          {isProject && share.about ? (
            <button
              onClick={() => setReading(true)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#ff4500]/40 py-1.5 text-xs font-semibold text-[#ff4500] hover:bg-orange-50"
            >
              <FileText size={11} /> Read brief
            </button>
          ) : share.url ? (
            <a
              href={share.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#ff4500]/40 py-1.5 text-xs font-semibold text-[#ff4500] hover:bg-orange-50"
            >
              {isProject ? 'Open brief' : 'View'} <ExternalLink size={11} />
            </a>
          ) : (
            <span className="flex-1" />
          )}
          {!mine && (
            <>
              <button
                onClick={() => void toggleHelped()}
                disabled={busy}
                aria-pressed={share.iHelped}
                title={share.iHelped ? 'You said this helped you' : `Tell ${share.sharedBy.name} this helped`}
                className={`flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  share.iHelped
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-[#edeff1] text-[#878a8c] hover:text-[#1c1c1c]'
                }`}
              >
                <HandHeart size={13} /> {share.iHelped ? 'Helped' : 'Helped me'}
              </button>
              <button
                onClick={() => openChatWith(share.sharedBy.id)}
                title={`Ask ${share.sharedBy.name} about this`}
                aria-label={`Ask ${share.sharedBy.name}`}
                className="flex items-center justify-center rounded-lg border border-[#edeff1] px-2.5 py-1.5 text-xs font-semibold text-[#878a8c] hover:text-[#1c1c1c]"
              >
                <MessageSquare size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {reading && share.about && (
        <BriefModal share={share} onClose={() => setReading(false)} onAsk={() => openChatWith(share.sharedBy.id)} />
      )}
    </article>
  )
}

/** A project brief's full problem statement, readable in place — enough for a
 *  member to start building, with the link (if any) and the alum to ask. */
function BriefModal({ share, onClose, onAsk }: { share: LearningShare; onClose: () => void; onAsk: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#edeff1] bg-white p-5 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-600">Project brief · {DIFFICULTY[share.difficulty]}</p>
            <h2 className="text-lg font-bold text-[#1c1c1c]">{share.title}</h2>
            <p className="text-xs text-[#878a8c]">
              From {share.sharedBy.name}
              {share.sharedBy.designation ? `, ${share.sharedBy.designation}` : ''}
              {share.estHours != null ? ` · about ${share.estHours} hours` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-xs italic text-[#1c1c1c]">“{share.whyHelped}”</p>
        <h3 className="mt-4 text-xs font-bold text-[#1c1c1c]">About the project</h3>
        <p className="mt-1 whitespace-pre-line text-sm text-[#1c1c1c]">{share.about}</p>
        {share.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {share.skills.map((s) => (
              <span key={s} className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[11px] text-[#1c1c1c]">
                {s}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {share.url && (
            <a
              href={share.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-[#ff4500] px-4 py-2 text-sm font-semibold text-[#ff4500] hover:bg-orange-50"
            >
              Open reference <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={() => {
              onClose()
              onAsk()
            }}
            className="inline-flex items-center gap-1 rounded-full bg-[#ff4500] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff6534]"
          >
            <MessageSquare size={13} /> Ask {share.sharedBy.name.split(' ')[0]}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
