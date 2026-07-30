import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Bookmark,
  Briefcase,
  CalendarDays,
  Clock,
  ExternalLink,
  Flag,
  MapPin,
  MessageCircle,
  Pin,
  Rocket,
  Send,
  Share2,
  Users,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Card, PostTypeBadge, VerifiedBadge } from '../ui'
import { ReportModal } from '../ReportModal'
import { Markdown } from '../../lib/markdown'
import { roleLine, safeUrl, timeAgo } from '../../lib/format'
import { REACTIONS, type Post } from '../../types'

export function PostCard({ post }: { post: Post }) {
  const { userById, react, toggleSave, addComment, communities, currentUser, notify } = useApp()
  const author = userById(post.authorId)
  const community = post.communityId ? communities.find((c) => c.id === post.communityId) : undefined

  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')
  const [reporting, setReporting] = useState(false)

  if (!author) return null

  function submitComment() {
    if (!draft.trim()) return
    addComment(post.id, draft)
    setDraft('')
    setShowComments(true)
  }

  const isProfileCard = post.type === 'Open to Work' || post.type === 'Hiring'

  // Copy a direct link to this post (Home scrolls to the anchor on load).
  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/home#post-${post.id}`)
      notify('Post link copied to clipboard.', 'info')
    } catch {
      notify('Could not copy the link.', 'error')
    }
  }

  return (
    <Card id={`post-${post.id}`} className={`overflow-hidden ${post.pinned ? 'ring-1 ring-[#ff4500]/30' : ''}`}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 border-b border-orange-100 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-[#ff4500]">
          <Pin size={13} /> Pinned by Rooman
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={author.name} src={author.photo} size={46} to={`/profile/${author.id}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to={`/profile/${author.id}`}
              className="inline-flex items-center gap-1 text-[15px] font-bold text-[#1c1c1c] transition-colors hover:text-[#ff4500]"
            >
              {author.name}
              <VerifiedBadge verified={author.emailVerified} size={15} />
            </Link>
            <PostTypeBadge type={post.type} />
          </div>
          {roleLine(author) && (
            <p className="truncate text-[13px] text-[#878a8c]">{roleLine(author)}</p>
          )}
          <p className="mt-0.5 text-xs text-[#a5a8ab]">
            {timeAgo(post.createdAt)}
            {community && (
              <>
                {' · in '}
                <Link to={`/community/${community.id}`} className="font-medium text-[#ff4500] hover:underline">
                  {community.name}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {isProfileCard && (post.role || post.company) && (
          <div
            className={`mb-3 rounded-xl border-l-4 px-3.5 py-2.5 ${
              post.type === 'Hiring' ? 'border-green-500 bg-green-50/70' : 'border-blue-500 bg-blue-50/70'
            }`}
          >
            <p className="text-[15px] font-bold text-[#1c1c1c]">
              {post.role ?? author.designation}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#5c6063]">
              <span className="inline-flex items-center gap-1">
                <Briefcase size={13} /> {post.company ?? author.company}
              </span>
              {post.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {post.city}
                </span>
              )}
              {post.domain && (
                <span className="rounded-full border border-[#edeff1] bg-white px-2 py-0.5 text-xs font-semibold text-[#5c6063]">
                  {post.domain}
                </span>
              )}
            </p>
          </div>
        )}
        <NewsMeta post={post} />
        {post.type === 'Article' ? (
          <Markdown text={post.content} className="mt-1" />
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1c1c1c]">{post.content}</p>
        )}

        {(post.domain || post.city || post.batch) && !isProfileCard && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.domain && <Tag>#{post.domain}</Tag>}
            {post.city && <Tag>#{post.city}</Tag>}
            {post.batch && <Tag>#Batch{post.batch}</Tag>}
          </div>
        )}
      </div>

      {post.image && (
        <img src={post.image} alt="" className="max-h-[420px] w-full object-cover" />
      )}

      {/* Reaction summary */}
      <ReactionSummary post={post} />

      {/* Action bar */}
      <div className="mx-3 mt-1 mb-1.5 flex items-center gap-1 border-t border-[#edeff1] pt-1.5 text-[#878a8c]">
        <ReactionControl post={post} react={react} />
        <ActionButton hover="hover:bg-blue-50 hover:text-blue-600" onClick={() => setShowComments((v) => !v)}>
          <MessageCircle size={18} />
          <span>{post.comments.length || 'Comment'}</span>
        </ActionButton>
        <ActionButton hover="hover:bg-green-50 hover:text-green-600" onClick={share}>
          <Share2 size={18} />
          <span className="hidden sm:inline">Share</span>
        </ActionButton>
        <ActionButton
          active={post.saved}
          hover="hover:bg-orange-50 hover:text-[#ff4500]"
          onClick={() => toggleSave(post.id)}
        >
          <Bookmark size={18} className={post.saved ? 'fill-[#ff4500] text-[#ff4500]' : ''} />
          <span className={`hidden sm:inline ${post.saved ? 'text-[#ff4500]' : ''}`}>{post.saved ? 'Saved' : 'Save'}</span>
        </ActionButton>
        {author.id !== currentUser.id && (
          <button
            onClick={() => setReporting(true)}
            // ml-auto: report stays pinned right, away from the action cluster.
            className="ml-auto rounded-lg p-2 text-[#c3c6c9] transition-colors hover:bg-red-50 hover:text-red-500"
            title="Report this post"
            aria-label="Report this post"
          >
            <Flag size={15} />
          </button>
        )}
      </div>

      {reporting && (
        <ReportModal
          targetType="post"
          targetId={post.id}
          targetLabel={`${author.name}'s post`}
          onClose={() => setReporting(false)}
        />
      )}

      {/* Comments */}
      {showComments && (
        <div className="border-t border-[#edeff1] px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <Avatar name={currentUser.name} src={currentUser.photo} size={32} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
              placeholder="Add a comment…"
              className="flex-1 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-4 py-2 text-sm outline-none focus:border-[#ff4500]"
            />
            <button
              onClick={submitComment}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#ff6534]"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {post.comments.map((c) => {
              const cu = userById(c.authorId)
              return (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={cu?.name ?? '?'} src={cu?.photo} size={32} />
                  <div className="rounded-2xl bg-[#f6f7f8] px-3 py-2">
                    <p className="text-xs font-semibold text-[#1c1c1c]">{cu?.name ?? 'Member'}</p>
                    <p className="text-sm text-[#1c1c1c]">{c.text}</p>
                  </div>
                </div>
              )
            })}
            {post.comments.length === 0 && (
              <p className="text-sm text-[#878a8c]">Be the first to comment.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function ActionButton({
  children,
  active = false,
  hover = 'hover:bg-gray-100',
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  hover?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      // Sized to its content, not flex-1: the actions group together at the left
      // of the bar instead of each stretching to a quarter of the card width.
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${hover} ${
        active ? 'text-[#ff4500]' : ''
      }`}
    >
      {children}
    </button>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-[#ff4500]/90">
      {children}
    </span>
  )
}

// Compact "who reacted" summary shown just above the action bar: the distinct
// emojis used and the total count. Hidden when a post has no reactions yet.
function ReactionSummary({ post }: { post: Post }) {
  const reactions = post.reactions ?? {}
  const total = Object.values(reactions).reduce((a, b) => a + b, 0)
  if (!total) return null
  // Show emojis in the canonical order, only those actually used.
  const emojis = REACTIONS.filter((e) => reactions[e])
  return (
    <div className="flex items-center gap-1.5 px-4 pt-2 text-xs text-[#878a8c]">
      <span className="text-sm leading-none">{emojis.join('')}</span>
      <span>{total}</span>
    </div>
  )
}

// React button with a hover-revealed emoji picker. Clicking the main button
// toggles your reaction (defaults to 👍); hovering reveals 🎉/❤️ to pick one.
function ReactionControl({ post, react }: { post: Post; react: (id: string, emoji: string) => void }) {
  const mine = post.myReaction
  return (
    <div className="group relative">
      <div className="pointer-events-none absolute bottom-full left-0 mb-1 flex gap-0.5 rounded-full border border-[#edeff1] bg-white p-1 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => react(post.id, e)}
            title={`React ${e}`}
            aria-label={`React ${e}`}
            className={`rounded-full px-1.5 py-0.5 text-xl leading-none transition-transform hover:scale-125 ${mine === e ? 'bg-orange-50' : ''}`}
          >
            {e}
          </button>
        ))}
      </div>
      <button
        onClick={() => react(post.id, mine ?? '👍')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors hover:bg-orange-50 hover:text-[#ff4500] ${
          mine ? 'text-[#ff4500]' : ''
        }`}
      >
        <span className="text-base leading-none">{mine ?? '👍'}</span>
        <span>{mine ? 'Reacted' : 'React'}</span>
      </button>
    </div>
  )
}

// Structured header for the peer-to-peer News formats. Renders the fields the
// composer collected (post.meta) above the body. For Article it renders the
// title + category + read time; the body itself is rendered as Markdown.
function NewsMeta({ post }: { post: Post }) {
  const m = post.meta ?? {}

  if (post.type === 'Achievement') {
    if (!m.jobTitle && !m.achievementCompany && !m.collaborators?.length) return null
    return (
      <div className="mb-3 rounded-xl border-l-4 border-amber-400 bg-amber-50/70 px-3.5 py-2.5">
        {(m.jobTitle || m.achievementCompany) && (
          <p className="flex items-center gap-2 text-[15px] font-bold text-[#1c1c1c]">
            <Award size={16} className="text-amber-500" />
            {m.jobTitle}
            {m.jobTitle && m.achievementCompany ? ' · ' : ''}
            {m.achievementCompany}
          </p>
        )}
        {m.collaborators?.length ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#5c6063]">
            <Users size={13} /> with {m.collaborators.join(', ')}
          </p>
        ) : null}
      </div>
    )
  }

  if (post.type === 'Project') {
    const demo = safeUrl(m.demoLink)
    return (
      <div className="mb-3 rounded-xl border-l-4 border-indigo-400 bg-indigo-50/60 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-[15px] font-bold text-[#1c1c1c]">
            <Rocket size={16} className="text-indigo-500" />
            {m.projectName || 'Project'}
          </p>
          {m.seeking && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {m.seeking}
            </span>
          )}
        </div>
        {m.techStack?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.techStack.map((t) => (
              <span key={t} className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-xs font-medium text-indigo-700">
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {demo && (
          <a
            href={demo}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#ff4500] hover:underline"
          >
            <ExternalLink size={14} /> View demo
          </a>
        )}
      </div>
    )
  }

  if (post.type === 'Meetup') {
    const rsvp = safeUrl(m.rsvpLink)
    return (
      <div className="mb-3 rounded-xl border-l-4 border-rose-400 bg-rose-50/60 px-3.5 py-2.5">
        <p className="flex items-center gap-2 text-[15px] font-bold text-[#1c1c1c]">
          <CalendarDays size={16} className="text-rose-500" />
          {m.title || 'Meetup'}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#5c6063]">
          {m.date && <span className="inline-flex items-center gap-1"><Clock size={13} /> {m.date}</span>}
          {m.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {m.location}</span>}
          {m.capacity ? <span className="inline-flex items-center gap-1"><Users size={13} /> {m.capacity} spots</span> : null}
        </p>
        {rsvp && (
          <a
            href={rsvp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-600"
          >
            RSVP
          </a>
        )}
      </div>
    )
  }

  if (post.type === 'Article') {
    const mins = Math.max(1, Math.round(post.content.trim().split(/\s+/).filter(Boolean).length / 200))
    return (
      <div className="mb-1.5">
        {m.title && <h2 className="text-lg font-bold leading-snug text-[#1c1c1c]">{m.title}</h2>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#878a8c]">
          {m.category && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">{m.category}</span>}
          <span className="inline-flex items-center gap-1"><Clock size={12} /> {mins} min read</span>
        </p>
      </div>
    )
  }

  return null
}
