import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Link as LinkIcon, MapPin, MessageSquare, UserPlus, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { useLayout } from '../layout/LayoutContext'
import { Avatar, Button, VerifiedBadge } from '../ui'
import { api } from '../../lib/api'
import type { Badge } from '../../types'

// Slide-out quick view of a person — bio, expertise, proof-of-work links and
// badges, and Connect/Message CTAs — without leaving the current page.
export function ProfileQuickView({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { userById, currentUser, connectionState, sendConnect } = useApp()
  const { openChatWith } = useLayout()
  const user = userById(userId)
  const [badges, setBadges] = useState<Badge[] | null>(null)

  useEffect(() => {
    setBadges(null)
    api.getBadges(userId).then(
      (d) => setBadges(d.badges.filter((b) => b.earned)),
      () => setBadges([]),
    )
  }, [userId])

  if (!user) return null
  const isMe = user.id === currentUser.id
  const conn = connectionState(user.id)
  const hasProofOfWork = !!user.linkedin || (badges?.length ?? 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="animate-slidein flex h-full w-[35vw] min-w-[320px] max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <h2 className="font-bold text-[#1c1c1c]">Quick view</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-5 py-5">
          <div className="flex flex-col items-center text-center">
            <Avatar name={user.name} src={user.photo} size={80} />
            <Link
              to={`/profile/${user.id}`}
              onClick={onClose}
              className="mt-3 inline-flex items-center gap-1 text-lg font-bold text-[#1c1c1c] hover:underline"
            >
              {user.name}
              <VerifiedBadge verified={user.emailVerified} size={16} />
            </Link>
            {(user.designation || user.company) && (
              <p className="text-sm text-[#878a8c]">
                {[user.designation, user.company].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#878a8c]">
              {user.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {user.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <GraduationCap size={12} /> Batch {user.batchYear}
              </span>
            </p>
          </div>

          {!isMe && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant={conn === 'none' ? 'primary' : 'subtle'}
                disabled={conn !== 'none'}
                onClick={() => sendConnect(user.id)}
              >
                <UserPlus size={15} />
                {conn === 'connected' ? 'Connected' : conn === 'pending' ? 'Request sent' : 'Connect'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  openChatWith(user.id)
                  onClose()
                }}
              >
                <MessageSquare size={15} /> Message
              </Button>
            </div>
          )}

          {user.bio && <p className="text-sm leading-relaxed text-[#1c1c1c]">{user.bio}</p>}

          <ExpertiseTags expertise={user.expertise} />

          {hasProofOfWork && (
            <div className="border-t border-[#edeff1] pt-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-[#878a8c] uppercase">Proof of work</p>
              {user.linkedin && (
                <a
                  href={user.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ff4500] hover:underline"
                >
                  <LinkIcon size={14} /> LinkedIn
                </a>
              )}
              {badges && badges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      title={b.description}
                      className="flex items-center gap-1 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-2.5 py-1 text-xs font-semibold text-[#1c1c1c]"
                    >
                      <span>{b.emoji}</span> {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link
            to={`/profile/${user.id}`}
            onClick={onClose}
            className="mt-auto pt-2 text-center text-sm font-semibold text-[#ff4500] hover:underline"
          >
            View full profile →
          </Link>
        </div>
      </div>
    </div>
  )
}

// Collapsed to a single row by default (long expertise lists were pushing
// "Proof of work" way down the drawer) — "Show more" expands to the full
// wrapped list on demand.
const COLLAPSED_SKILL_COUNT = 5

function ExpertiseTags({ expertise }: { expertise: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (expertise.length === 0) return null

  const hiddenCount = expertise.length - COLLAPSED_SKILL_COUNT
  const shown = expanded || hiddenCount <= 0 ? expertise : expertise.slice(0, COLLAPSED_SKILL_COUNT)

  return (
    <div className={`flex gap-1.5 ${expanded ? 'flex-wrap' : 'overflow-hidden'}`}>
      {shown.map((e) => (
        <span
          key={e}
          className="shrink-0 rounded-full bg-[#f6f7f8] px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#878a8c]"
        >
          {e}
        </span>
      ))}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#ff4500] hover:bg-orange-100"
        >
          {expanded ? 'Show less' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}
