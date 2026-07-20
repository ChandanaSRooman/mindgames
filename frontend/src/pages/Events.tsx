import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, CalendarPlus, Check, Clock, ExternalLink, MapPin, Ticket, Trash2, Users, Video, X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { api } from '../lib/api'
import { Avatar, Button, Card } from '../components/ui'
import type { AppEvent } from '../types'

// Alumni events: meetups, webinars and reunions with one-click RSVP.
export function Events() {
  const { events } = useApp()
  const [tab, setTab] = useState<'Upcoming' | 'Past'>('Upcoming')
  const [showCreate, setShowCreate] = useState(false)

  const now = Date.now()
  const upcoming = useMemo(
    () => events.filter((e) => +new Date(e.startsAt) >= now).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [events, now],
  )
  const past = useMemo(
    () => events.filter((e) => +new Date(e.startsAt) < now).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)),
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
        <EventCard key={e.id} event={e} isPast={tab === 'Past'} />
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

function EventCard({ event: e, isPast }: { event: AppEvent; isPast: boolean }) {
  const { userById, currentUser, toggleRsvp, cancelEvent } = useApp()
  const creator = userById(e.creatorId)
  const isMine = e.creatorId === currentUser.id
  const start = new Date(e.startsAt)

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
                {e.rsvpCount} going
              </span>
              <span className="text-xs text-[#a5a8ab]">
                · hosted by{' '}
                <Link to={`/profile/${e.creatorId}`} className="font-medium text-[#878a8c] hover:underline">
                  {isMine ? 'you' : creator?.name}
                </Link>
              </span>
            </div>

            {!isPast && (
              <div className="flex items-center gap-2">
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
                  variant={e.rsvpedByMe ? 'subtle' : 'primary'}
                  className="!px-4 !py-1.5 text-sm"
                  onClick={() => toggleRsvp(e.id)}
                >
                  {e.rsvpedByMe ? (
                    <>
                      <Check size={15} /> Going
                    </>
                  ) : (
                    'RSVP'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const { createEvent, notify, currentUser } = useApp()
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '', meetingLink: '', description: '' })
  const [isPaid, setIsPaid] = useState(false)
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const priceValue = Math.max(0, Math.round(Number(price) || 0))
  const canSubmit = form.title.trim() && form.date && form.time && (!isPaid || priceValue > 0)
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
