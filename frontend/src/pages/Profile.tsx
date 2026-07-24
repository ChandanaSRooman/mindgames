import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Award,
  Briefcase,
  Check,
  ChevronDown,
  GraduationCap,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Flag,
  Handshake,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useLayout } from '../components/layout/LayoutContext'
import { Button, Card, VerifiedBadge } from '../components/ui'
import { PostCard } from '../components/feed/PostCard'
import { EditProfileModal } from '../components/profile/EditProfileModal'
import { ProfilePhoto } from '../components/profile/ProfilePhoto'
import { ReportModal } from '../components/ReportModal'
import { compact } from '../lib/format'
import { api } from '../lib/api'
import { PROFILE_TAGS, type Badge, type ProfileTag, type User } from '../types'

export function Profile() {
  const { id } = useParams<{ id: string }>()
  const { currentUser, userById, posts, connectionState, sendConnect, updateProfile, notify, messageUser, sendMessage } = useApp()
  const [showReferral, setShowReferral] = useState(false)
  const [reportingUser, setReportingUser] = useState(false)
  const navigate = useNavigate()
  const { openComposer, openChatWith } = useLayout()
  const [editing, setEditing] = useState(false)

  const targetId = id ?? currentUser.id
  const user = userById(targetId)
  const isMe = targetId === currentUser.id

  const userPosts = useMemo(() => posts.filter((p) => p.authorId === targetId), [posts, targetId])

  if (!user) return <Navigate to="/home" replace />

  const conn = connectionState(user.id)

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-[#ff4500] to-[#ff6534]" />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between">
            <span className="inline-block rounded-full ring-4 ring-white">
              <ProfilePhoto
                name={user.name}
                photo={user.photo}
                size={88}
                canEdit={isMe}
                onChange={async (photo) => {
                  try {
                    await updateProfile({ photo })
                    notify(photo ? 'Profile photo updated.' : 'Profile photo removed.')
                  } catch {
                    notify('Could not update your photo. Try again.', 'error')
                  }
                }}
              />
            </span>
            <ProfileTagBadge user={user} isMe={isMe} />
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-1.5 text-xl font-bold text-[#1c1c1c]">
                {user.name}
                <VerifiedBadge verified={user.emailVerified} size={18} />
              </h1>
              {(user.designation || user.company) && (
                <p className="text-sm text-[#1c1c1c]">{[user.designation, user.company].filter(Boolean).join(' · ')}</p>
              )}
              {!user.designation && !user.company && user.college && (
                <p className="text-sm text-[#1c1c1c]">{user.college}</p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#878a8c]">
                <span className="flex items-center gap-1"><MapPin size={12} /> {user.city}</span>
                <span className="flex items-center gap-1"><GraduationCap size={12} /> Batch {user.batchYear} · {user.course}</span>
                <span className="flex items-center gap-1"><Briefcase size={12} /> {user.experienceYears} yrs · {user.domain}</span>
              </p>
              <p className="mt-1 text-xs font-medium text-[#1c1c1c]">{compact(user.connectionsCount)} connections</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isMe ? (
                <Button variant="outline" onClick={() => setEditing(true)}>Edit Profile</Button>
              ) : (
                <>
                  <Button
                    icon={<UserPlus size={15} />}
                    variant={conn === 'none' ? 'primary' : 'subtle'}
                    disabled={conn !== 'none'}
                    onClick={() => sendConnect(user.id)}
                  >
                    {conn === 'connected' ? 'Connected' : conn === 'pending' ? 'Request sent' : 'Connect'}
                  </Button>
                  <Button variant="outline" icon={<MessageSquare size={15} />} onClick={() => openChatWith(user.id)}>Message</Button>
                  {user.company && (
                    <Button variant="subtle" icon={<Handshake size={15} />} onClick={() => setShowReferral(true)}>
                      Request Referral
                    </Button>
                  )}
                  <button
                    onClick={() => setReportingUser(true)}
                    className="rounded-full p-2 text-[#c3c6c9] transition-colors hover:bg-red-50 hover:text-red-500"
                    title={`Report ${user.name}`}
                    aria-label={`Report ${user.name}`}
                  >
                    <Flag size={16} />
                  </button>
                  {user.isMentor && (
                    <Button variant="ghost" className="!text-[#ff4500]" onClick={() => navigate('/mentorship')}>
                      Book Session
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bio */}
          <p className="mt-4 text-sm leading-relaxed text-[#1c1c1c]">{user.bio}</p>

          {/* Expertise */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {user.expertise.map((e) => (
              <span key={e} className="rounded-full bg-[#f6f7f8] px-2.5 py-1 text-xs font-medium text-[#878a8c]">{e}</span>
            ))}
          </div>

          {user.linkedin && (
            <a href={user.linkedin} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#ff4500] hover:underline">
              <LinkIcon size={14} /> LinkedIn
            </a>
          )}
        </div>
      </Card>

      <AchievementsCard userId={user.id} isMe={isMe} />

      {/* Posts */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1c1c1c]">{isMe ? 'Your Posts' : 'Posts'}</h2>
        {isMe && <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openComposer()}>New Post</Button>}
      </div>
      {userPosts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {userPosts.length === 0 && (
        <div className="rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
          No posts yet.
        </div>
      )}

      {reportingUser && (
        <ReportModal
          targetType="user"
          targetId={user.id}
          targetLabel={user.name}
          onClose={() => setReportingUser(false)}
        />
      )}
      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
      {showReferral && (
        <ReferralModal
          user={user}
          onClose={() => setShowReferral(false)}
          onSend={async (role, note) => {
            const text =
              `Hi ${user.name.split(' ')[0]}, I'd love a referral at ${user.company}` +
              (role ? ` for a ${role} role` : '') +
              (note ? `.\n\n${note}` : '.') +
              `\n\n(Sent via Request Referral on RooConnect)`
            const threadId = await messageUser(user.id)
            sendMessage(threadId, text)
            setShowReferral(false)
            notify(`Referral request sent to ${user.name} — check your chat for replies.`)
            openChatWith(user.id)
          }}
        />
      )}
    </div>
  )
}

// The profile status tag ('Mentor' / 'Hiring' / 'Open to Work'). Static for
// visitors; on your own profile, click it to switch or remove. Older accounts
// without an explicit tag fall back to their mentor / open-to-work status.
const TAG_STYLES: Record<ProfileTag, { classes: string; icon: ReactNode; blurb: string }> = {
  Mentor: {
    classes: 'bg-orange-100 text-[#ff4500]',
    icon: <Award size={14} />,
    blurb: 'Listed on the Mentorship page',
  },
  Hiring: {
    classes: 'bg-green-100 text-green-700',
    icon: <Briefcase size={14} />,
    blurb: 'You are hiring for your team',
  },
  'Open to Work': {
    classes: 'bg-blue-100 text-blue-700',
    icon: <Search size={14} />,
    blurb: 'Listed under Jobs → Open to Work',
  },
}

function ProfileTagBadge({ user, isMe }: { user: User; isMe: boolean }) {
  const { updateProfile, notify } = useApp()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Fallback for accounts created before explicit tags existed.
  const current: ProfileTag | null =
    user.profileTag ??
    (user.isMentor ? 'Mentor' : user.employmentType === 'Looking for opportunity' ? 'Open to Work' : null)

  if (!current && !isMe) return null

  // Keep the systems behind each tag in sync: Mentor drives the Mentorship
  // page listing; Open to Work drives the Jobs → Open to Work tab.
  async function choose(tag: ProfileTag | null) {
    setSaving(true)
    try {
      // profileTag alone drives the badge and the Jobs → Open to Work listing
      // (see Jobs.tsx's openToWork filter) — it doesn't touch employmentType,
      // which stays whatever the user's actual Current Status is. That also
      // means picking "Open to Work" no longer requires guessing what to
      // restore employmentType to if the tag is later removed.
      await updateProfile({
        profileTag: tag,
        willingToMentor: tag === 'Mentor',
        isMentor: tag === 'Mentor',
      })
      notify(tag ? `Your profile now shows "${tag}".` : 'Tag removed from your profile.')
      setOpen(false)
    } catch {
      notify('Could not update your tag. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      {current ? (
        <button
          onClick={isMe ? () => setOpen((v) => !v) : undefined}
          className={`mb-2 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${TAG_STYLES[current].classes} ${
            isMe ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
          }`}
          title={isMe ? 'Change your tag' : current}
        >
          {TAG_STYLES[current].icon} {current}
          {isMe && <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        </button>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mb-2 flex items-center gap-1 rounded-full border border-dashed border-[#878a8c]/60 px-3 py-1 text-xs font-semibold text-[#878a8c] hover:border-[#ff4500]/60 hover:text-[#ff4500]"
          title="Show a status tag on your profile"
        >
          <Plus size={13} /> Add tag
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-60 rounded-xl border border-[#edeff1] bg-white p-1 shadow-lg">
          {PROFILE_TAGS.map((tag) => (
            <button
              key={tag}
              disabled={saving}
              onClick={() => choose(tag)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
            >
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_STYLES[tag].classes}`}>
                {TAG_STYLES[tag].icon} {tag}
              </span>
              <span className="ml-auto">{current === tag && <Check size={15} className="text-[#ff4500]" />}</span>
            </button>
          ))}
          <p className="px-3 pt-1 pb-1.5 text-[11px] leading-snug text-[#878a8c]">
            {open && current ? TAG_STYLES[current].blurb : 'Pick what the network should know about you right now.'}
          </p>
          {current && (
            <button
              disabled={saving}
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} /> Remove tag
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Achievements: computed badges + points, fetched per profile.
function AchievementsCard({ userId, isMe }: { userId: string; isMe: boolean }) {
  const [data, setData] = useState<{ points: number; badges: Badge[] } | null>(null)

  useEffect(() => {
    setData(null)
    api.getBadges(userId).then(setData, () => setData(null))
  }, [userId])

  const earned = data?.badges.filter((b) => b.earned) ?? []
  if (!data || earned.length === 0) return null

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1c1c1c]">Achievements</h2>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#ff4500]">
          ⭐ {data.points} points
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {earned.map((b) => (
          <span
            key={b.id}
            title={b.description}
            className="flex cursor-default items-center gap-1.5 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-3 py-1.5 text-sm font-semibold text-[#1c1c1c]"
          >
            <span>{b.emoji}</span> {b.label}
          </span>
        ))}
      </div>
      {isMe && data.badges.some((b) => !b.earned) && (
        <p className="mt-3 text-xs text-[#878a8c]">
          {data.badges.filter((b) => b.earned).length}/{data.badges.length} earned — keep posting,
          connecting and mentoring to unlock the rest.
        </p>
      )}
    </Card>
  )
}

// Ask a fellow alumnus for a referral at their company (delivered via chat).
function ReferralModal({
  user,
  onClose,
  onSend,
}: {
  user: User
  onClose: () => void
  onSend: (role: string, note: string) => Promise<void>
}) {
  const [role, setRole] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="animate-slidein w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <Handshake size={18} className="text-[#ff4500]" />
            <h2 className="font-bold text-[#1c1c1c]">Request a referral</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[#878a8c]">
            Ask <span className="font-semibold text-[#1c1c1c]">{user.name}</span> to refer you at{' '}
            <span className="font-semibold text-[#1c1c1c]">{user.company}</span>. It lands in your
            chat so you can continue the conversation there.
          </p>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role you're interested in (optional)"
            className="w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="A short note — your experience, why you're a fit… (optional)"
            className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#edeff1] px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={sending}
            onClick={async () => {
              setSending(true)
              try {
                await onSend(role.trim(), note.trim())
              } finally {
                setSending(false)
              }
            }}
          >
            {sending ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </div>
    </div>
  )
}
