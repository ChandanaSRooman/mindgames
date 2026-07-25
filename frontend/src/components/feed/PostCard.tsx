import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  Briefcase,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Pin,
  Send,
  Share2,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Card, PostTypeBadge, VerifiedBadge } from '../ui'
import { ReportModal } from '../ReportModal'
import { roleLine, timeAgo } from '../../lib/format'
import type { Post } from '../../types'

export function PostCard({ post }: { post: Post }) {
  const { userById, toggleLike, toggleSave, addComment, communities, currentUser, notify } = useApp()
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
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1c1c1c]">{post.content}</p>

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

      {/* Action bar */}
      <div className="mx-3 mt-1 mb-1.5 flex items-center gap-1 border-t border-[#edeff1] pt-1.5 text-[#878a8c]">
        <ActionButton
          active={post.likedByMe}
          hover="hover:bg-orange-50 hover:text-[#ff4500]"
          onClick={() => toggleLike(post.id)}
        >
          <Heart size={18} className={post.likedByMe ? 'fill-[#ff4500] text-[#ff4500]' : ''} />
          <span className={post.likedByMe ? 'text-[#ff4500]' : ''}>{post.likes || 'Like'}</span>
        </ActionButton>
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
