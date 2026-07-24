import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Radio,
  Send,
  Star,
  Ticket,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { api } from '../lib/api'
import { Avatar, Button, Card, VerifiedBadge } from '../components/ui'
import { PostCard } from '../components/feed/PostCard'
import type { AppEvent, Comment, EventFeedbackEntry, Post } from '../types'

// Matches the 1-hour default duration assumed by the .ics export — used here
// to decide when an event flips from "Live now" to "Ended".
const EVENT_DURATION_MS = 60 * 60 * 1000

type EventPhase = 'upcoming' | 'live' | 'ended'

function phaseOf(startsAt: string, now: number): EventPhase {
  const start = +new Date(startsAt)
  const end = start + EVENT_DURATION_MS
  if (now < start) return 'upcoming'
  if (now < end) return 'live'
  return 'ended'
}

// Live countdown/status for one event: ticks every second while upcoming or
// live so the "Starts in…" timer and the live/ended flip feel real-time.
function useEventPhase(startsAt: string) {
  const [now, setNow] = useState(() => Date.now())
  const phase = phaseOf(startsAt, now)

  useEffect(() => {
    if (phase === 'ended') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  const start = +new Date(startsAt)
  const diff = Math.max(0, start - now)
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let countdownLabel = ''
  if (days > 0) countdownLabel = `${days}d ${hours}h`
  else if (hours > 0) countdownLabel = `${hours}h ${minutes}m`
  else countdownLabel = `${minutes}m ${seconds}s`

  return { phase, countdownLabel }
}

function EventPhaseBadge({ startsAt }: { startsAt: string }) {
  const { phase, countdownLabel } = useEventPhase(startsAt)
  if (phase === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
        <Radio size={11} className="animate-pulse" /> Live now
      </span>
    )
  }
  if (phase === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
        <Clock size={11} /> Starts in {countdownLabel}
      </span>
    )
  }
  return null
}

// Alumni events: meetups, webinars and reunions with one-click RSVP.
export function Events() {
  const { events, posts } = useApp()
  const [tab, setTab] = useState<'Upcoming' | 'Past'>('Upcoming')
  const [showCreate, setShowCreate] = useState(false)

  const now = Date.now()
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => +new Date(e.startsAt) + EVENT_DURATION_MS >= now)
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [events, now],
  )
  const past = useMemo(
    () =>
      events
        .filter((e) => +new Date(e.startsAt) + EVENT_DURATION_MS < now)
        .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)),
    [events, now],
  )
  const shown = tab === 'Upcoming' ? upcoming : past

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1c1c1c]">Events</h1>
        <Button onClick={() => setShowCreate(true)}>
          <CalendarPlus size={16} /> Host an event
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center rounded-xl border border-[#edeff1] bg-white px-2 shadow-sm">
        {(['Upcoming', 'Past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
              tab === t ? 'text-[#ff4500]' : 'text-[#878a8c] hover:text-[#1c1c1c]'
            }`}
          >
            {t} {t === 'Upcoming' && upcoming.length > 0 && `(${upcoming.length})`}
            {tab === t && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-[#ff4500]" />}
          </button>
        ))}
      </div>

      {shown.map((e) => (
        <EventCard
          key={e.id}
          event={e}
          isPast={tab === 'Past'}
          updates={posts.filter((p) => p.eventId === e.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))}
        />
      ))}

      {shown.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[#edeff1] bg-white py-16 text-center shadow-sm">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-[#ff4500]">
            <Calendar size={28} />
          </span>
          <p className="font-semibold text-[#1c1c1c]">
            {tab === 'Upcoming' ? 'No upcoming events yet' : 'No past events'}
          </p>
          {tab === 'Upcoming' && (
            <>
              <p className="max-w-sm text-sm text-[#878a8c]">
                Be the one who brings the network together — host a meetup, webinar or batch reunion.
              </p>
              <Button className="mt-1" onClick={() => setShowCreate(true)}>
                <CalendarPlus size={16} /> Host the first event
              </Button>
            </>
          )}
        </div>
      )}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function EventCard({
  event: e,
  isPast,
  updates,
}: {
  event: AppEvent
  isPast: boolean
  updates: Post[]
}) {
  const { userById, currentUser, toggleRsvp, cancelEvent } = useApp()
  const creator = userById(e.creatorId)
  const isMine = e.creatorId === currentUser.id
  const canPostUpdate = isMine || currentUser.isAdmin
  const start = new Date(e.startsAt)
  const [showPostUpdate, setShowPostUpdate] = useState(false)
  const [showDiscussion, setShowDiscussion] = useState(false)
  const [showHostFeedback, setShowHostFeedback] = useState(false)

  return (
    <Card className="p-5">
      <div className="flex gap-4">
        {/* Date block */}
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-50 text-[#ff4500]">
          <span className="text-[11px] font-bold uppercase">
            {start.toLocaleDateString('en-IN', { month: 'short' })}
          </span>
          <span className="text-2xl leading-none font-extrabold">{start.getDate()}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-[#1c1c1c]">{e.title}</h3>
            {e.status === 'pending' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <Clock size={11} /> Pending approval
              </span>
            )}
            {e.status !== 'pending' && <EventPhaseBadge startsAt={e.startsAt} />}
            {e.feedbackCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                <Star size={11} className="fill-yellow-500 text-yellow-500" /> {e.avgRating} ({e.feedbackCount})
              </span>
            )}
            {e.isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-[#ff4500]">
                <Ticket size={11} /> ₹{(e.price ?? 0).toLocaleString('en-IN')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                Free
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#878a8c]">
            <span>
              {start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {start.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {e.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {e.location}
              </span>
            )}
            {e.meetingLink && (
              <a
                href={e.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#ff4500] hover:underline"
              >
                <Video size={13} /> Join link <ExternalLink size={11} />
              </a>
            )}
          </p>
          {e.description && <p className="mt-2 text-sm leading-relaxed text-[#1c1c1c]">{e.description}</p>}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {e.attendeeIds.slice(0, 5).map((id) => {
                  const u = userById(id)
                  return (
                    <span key={id} className="rounded-full ring-2 ring-white">
                      <Avatar name={u?.name ?? '?'} src={u?.photo} size={26} />
                    </span>
                  )
                })}
              </div>
              <span className="text-xs text-[#878a8c]">
                <Users size={12} className="mr-0.5 inline" />
                {e.rsvpCount}{e.capacity ? ` / ${e.capacity}` : ''} going
                {e.waitlistCount > 0 && ` · ${e.waitlistCount} waitlisted`}
              </span>
              <span className="text-xs text-[#a5a8ab]">
                · hosted by{' '}
                <Link
                  to={`/profile/${e.creatorId}`}
                  className="inline-flex items-center gap-1 font-medium text-[#878a8c] hover:underline"
                >
                  {isMine ? 'you' : creator?.name}
                  <VerifiedBadge verified={creator?.emailVerified} size={12} />
                </Link>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="!px-3 !py-1.5 text-xs"
                title="Discuss this event"
                onClick={() => setShowDiscussion((v) => !v)}
              >
                <MessageCircle size={14} /> Discuss
              </Button>
              {canPostUpdate && (
                <Button
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  title="Post an update about this event"
                  onClick={() => setShowPostUpdate(true)}
                >
                  <MessageSquarePlus size={14} /> Post update
                </Button>
              )}
              {canPostUpdate && isPast && (
                <Button
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  title="See attendee ratings and comments"
                  onClick={() => setShowHostFeedback(true)}
                >
                  <Star size={14} /> View feedback
                </Button>
              )}
              {isPast && e.rsvpedByMe && (
                <Button
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  title="Download your certificate of attendance"
                  onClick={async () => {
                    try {
                      const blob = await api.downloadEventCertificate(e.id)
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                      setTimeout(() => URL.revokeObjectURL(url), 60_000)
                    } catch {
                      /* toast not critical here */
                    }
                  }}
                >
                  <Award size={14} /> Certificate
                </Button>
              )}
              {!isPast && (
                <>
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    title="Download .ics for your calendar"
                    onClick={async () => {
                      try {
                        const blob = await api.downloadEventIcs(e.id)
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${e.title.replace(/[^\w ]/g, '').trim() || 'event'}.ics`
                        a.click()
                        URL.revokeObjectURL(url)
                      } catch {
                        /* toast not critical here */
                      }
                    }}
                  >
                    <Calendar size={14} /> Add to calendar
                  </Button>
                  {isMine && (
                    <Button
                      variant="ghost"
                      className="!px-3 !py-1.5 text-xs !text-red-500 hover:!bg-red-50"
                      onClick={() => cancelEvent(e.id)}
                    >
                      <Trash2 size={14} /> Cancel event
                    </Button>
                  )}
                  <Button
                    variant={e.rsvpedByMe || e.waitlistedByMe ? 'subtle' : 'primary'}
                    className="!px-4 !py-1.5 text-sm"
                    onClick={() => toggleRsvp(e.id)}
                  >
                    {e.rsvpedByMe ? (
                      <>
                        <Check size={15} /> Going
                      </>
                    ) : e.waitlistedByMe ? (
                      'On waitlist'
                    ) : e.capacity != null && e.rsvpCount >= e.capacity ? (
                      'Join waitlist'
                    ) : (
                      'RSVP'
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {isPast && e.rsvpedByMe && !e.feedbackByMe && <EventFeedbackForm eventId={e.id} />}

          {showDiscussion && <EventDiscussion eventId={e.id} />}

          {updates.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 border-t border-[#edeff1] pt-3">
              <p className="text-xs font-semibold text-[#878a8c]">Updates ({updates.length})</p>
              {updates.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showPostUpdate && <PostEventUpdateModal event={e} onClose={() => setShowPostUpdate(false)} />}
      {showHostFeedback && <EventFeedbackModal event={e} onClose={() => setShowHostFeedback(false)} />}
    </Card>
  )
}

// Star rating + optional comment, submitted once after an ended event.
function EventFeedbackForm({ eventId }: { eventId: string }) {
  const { submitEventFeedback, notify } = useApp()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!rating) return
    setSaving(true)
    try {
      await submitEventFeedback(eventId, rating, comment.trim())
      notify('Thanks for the feedback!', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not submit feedback.', 'error')
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#edeff1] bg-[#f6f7f8] p-3">
      <p className="text-xs font-semibold text-[#1c1c1c]">How was this event?</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(n)}
            className="p-0.5"
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              size={20}
              className={n <= (hovered || rating) ? 'fill-yellow-500 text-yellow-500' : 'text-[#c3c6c9]'}
            />
          </button>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything you'd add? (optional)"
        className="w-full rounded-lg border border-[#edeff1] bg-white px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
      />
      <Button className="self-start !px-4 !py-1.5 text-xs" disabled={!rating || saving} onClick={submit}>
        {saving ? 'Submitting…' : 'Submit feedback'}
      </Button>
    </div>
  )
}

// Host/admin view of every attendee's rating + comment.
function EventFeedbackModal({ event: e, onClose }: { event: AppEvent; onClose: () => void }) {
  const [entries, setEntries] = useState<EventFeedbackEntry[] | null>(null)

  useEffect(() => {
    api.getEventFeedback(e.id).then(setEntries, () => setEntries([]))
  }, [e.id])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="animate-slidein my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-[#ff4500]" />
            <h2 className="font-bold text-[#1c1c1c]">Feedback — {e.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {entries === null && <p className="text-sm text-[#878a8c]">Loading…</p>}
          {entries?.length === 0 && <p className="text-sm text-[#878a8c]">No feedback submitted yet.</p>}
          {entries?.map((f) => (
            <div key={f.userId} className="flex gap-2">
              <Avatar name={f.name} src={f.photo} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#1c1c1c]">{f.name}</p>
                  <span className="inline-flex items-center gap-0.5 text-xs text-yellow-600">
                    <Star size={11} className="fill-yellow-500 text-yellow-500" /> {f.rating}
                  </span>
                </div>
                {f.comment && <p className="text-sm text-[#1c1c1c]">{f.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Lightweight Q&A/discussion thread on the event itself (distinct from the
// event's linked feed posts and their comments).
function EventDiscussion({ eventId }: { eventId: string }) {
  const { currentUser, userById } = useApp()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    api.getEventComments(eventId).then(setComments, () => setComments([]))
  }, [eventId])

  async function submit() {
    if (!draft.trim()) return
    setPosting(true)
    try {
      const created = await api.addEventComment(eventId, draft.trim())
      setComments((list) => [...(list ?? []), created])
      setDraft('')
    } catch {
      /* toast not critical here */
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[#edeff1] pt-3">
      <div className="flex items-center gap-2">
        <Avatar name={currentUser.name} src={currentUser.photo} size={30} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask a question or leave a note…"
          className="flex-1 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-4 py-2 text-sm outline-none focus:border-[#ff4500]"
        />
        <button
          onClick={submit}
          disabled={posting || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#ff6534] disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>
      {comments === null && <p className="text-xs text-[#878a8c]">Loading discussion…</p>}
      <div className="flex flex-col gap-2">
        {comments?.map((c) => {
          const author = userById(c.authorId)
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar name={author?.name ?? '?'} src={author?.photo} size={30} />
              <div className="rounded-2xl bg-[#f6f7f8] px-3 py-2">
                <p className="text-xs font-semibold text-[#1c1c1c]">{author?.name ?? 'Member'}</p>
                <p className="text-sm text-[#1c1c1c]">{c.text}</p>
              </div>
            </div>
          )
        })}
        {comments?.length === 0 && <p className="text-xs text-[#878a8c]">No comments yet — be the first to ask something.</p>}
      </div>
    </div>
  )
}

function PostEventUpdateModal({ event: e, onClose }: { event: AppEvent; onClose: () => void }) {
  const { createPost } = useApp()
  const [content, setContent] = useState('')

  function submit() {
    if (!content.trim()) return
    createPost({ type: 'Update', content, visibility: 'All Alumni', eventId: e.id })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="animate-slidein my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-[#ff4500]" />
            <h2 className="font-bold text-[#1c1c1c]">Post an update — {e.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <textarea
            autoFocus
            value={content}
            onChange={(ev) => setContent(ev.target.value)}
            rows={4}
            placeholder="Share a change of plan, the meeting link, a recap photo caption…"
            className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
          />
          <p className="text-xs text-[#878a8c]">
            This posts to the main feed and notifies everyone who RSVP'd to "{e.title}".
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#edeff1] px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!content.trim()} onClick={submit}>Post update</Button>
        </div>
      </div>
    </div>
  )
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const { createEvent, notify, currentUser } = useApp()
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '', meetingLink: '', description: '' })
  const [isPaid, setIsPaid] = useState(false)
  const [price, setPrice] = useState('')
  const [hasCapacity, setHasCapacity] = useState(false)
  const [capacity, setCapacity] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const priceValue = Math.max(0, Math.round(Number(price) || 0))
  const capacityValue = Math.round(Number(capacity) || 0)
  const canSubmit =
    form.title.trim() && form.date && form.time && (!isPaid || priceValue > 0) && (!hasCapacity || capacityValue > 0)
  const field =
    'w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]'

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      await createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        meetingLink: form.meetingLink.trim() || undefined,
        startsAt: new Date(`${form.date}T${form.time}`).toISOString(),
        isPaid,
        price: isPaid ? priceValue : 0,
        capacity: hasCapacity ? Math.max(1, capacityValue) : undefined,
      })
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create the event.', 'error')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="animate-slidein my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-[#ff4500]" />
            <h2 className="font-bold text-[#1c1c1c]">Host an event</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Event title — e.g. Bengaluru Alumni Meetup" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#878a8c]">Date</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#878a8c]">Time</label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} className={field} />
            </div>
          </div>
          <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Venue — or 'Online'" className={field} />
          <input value={form.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} placeholder="Meeting link (optional, for online events)" className={field} />

          {/* Ticketing */}
          <div className="rounded-lg border border-[#edeff1] p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#ff4500]" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
              <span className="text-sm font-medium text-[#1c1c1c]">This is a paid event</span>
            </label>
            {isPaid && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-[#878a8c]">Ticket price (₹ per attendee)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#878a8c]">₹</span>
                  <input
                    type="number"
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 500"
                    className={field}
                  />
                </div>
                <p className="mt-1 text-xs text-[#878a8c]">Attendees pay offline / at the venue — RSVP just records who's coming.</p>
              </div>
            )}
          </div>

          {/* Capacity */}
          <div className="rounded-lg border border-[#edeff1] p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#ff4500]" checked={hasCapacity} onChange={(e) => setHasCapacity(e.target.checked)} />
              <span className="text-sm font-medium text-[#1c1c1c]">Limit capacity</span>
            </label>
            {hasCapacity && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-[#878a8c]">Max confirmed attendees</label>
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 50"
                  className={field}
                />
                <p className="mt-1 text-xs text-[#878a8c]">RSVPs beyond this number join a waitlist and are auto-confirmed as spots free up.</p>
              </div>
            )}
          </div>

          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What's the plan?" className={`${field} resize-none`} />
          <p className="text-xs text-[#878a8c]">
            {currentUser.isAdmin
              ? 'Everyone on the network gets a notification, and the event appears on this page and the sidebar.'
              : 'Your event is sent to an admin for approval. Once approved, the whole network is notified.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#edeff1] px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit || saving} onClick={submit}>
            {saving ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      </div>
    </div>
  )
}
