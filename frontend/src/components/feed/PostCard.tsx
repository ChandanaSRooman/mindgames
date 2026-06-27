import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  Heart,
  MapPin,
  MessageCircle,
  Pin,
  Send,
  Share2,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Card, PostTypeBadge } from '../ui'
import { timeAgo } from '../../lib/format'
import type { Post } from '../../types'

export function PostCard({ post }: { post: Post }) {
  const { userById, toggleLike, toggleSave, addComment, communities, currentUser, notify } = useApp()
  const author = userById(post.authorId)
  const community = post.communityId ? communities.find((c) => c.id === post.communityId) : undefined

  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')

  if (!author) return null

  function submitComment() {
    if (!draft.trim()) return
    addComment(post.id, draft)
    setDraft('')
    setShowComments(true)
  }

  const isProfileCard = post.type === 'Open to Work' || post.type === 'Hiring'

  return (
    <Card className={`overflow-hidden ${post.pinned ? 'ring-1 ring-[#ff4500]/30' : ''}`}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 border-b border-orange-100 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-[#ff4500]">
          <Pin size={13} /> Pinned by Rooman
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={author.name} size={44} to={`/profile/${author.id}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <Link to={`/profile/${author.id}`} className="font-semibold text-[#1c1c1c] hover:underline">
              {author.name}
            </Link>
            <PostTypeBadge type={post.type} />
          </div>
          <p className="truncate text-xs text-[#878a8c]">
            {author.designation} · {author.company}
          </p>
          <p className="text-xs text-[#878a8c]">
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
          <div className="mb-3 rounded-lg border border-[#edeff1] bg-[#f6f7f8] px-3 py-2">
            <p className="text-sm font-semibold text-[#1c1c1c]">
              {post.role ?? author.designation}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-[#878a8c]">
              {post.company ?? author.company}
              {post.city && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin size={12} /> {post.city}
                </span>
              )}
              {post.domain && <span>· {post.domain}</span>}
            </p>
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1c1c1c]">{post.content}</p>

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
      <div className="flex items-center gap-1 px-2 py-1.5 text-[#878a8c]">
        <ActionButton active={post.likedByMe} onClick={() => toggleLike(post.id)}>
          <Heart size={18} className={post.likedByMe ? 'fill-[#ff4500] text-[#ff4500]' : ''} />
          <span className={post.likedByMe ? 'text-[#ff4500]' : ''}>{post.likes}</span>
        </ActionButton>
        <ActionButton onClick={() => setShowComments((v) => !v)}>
          <MessageCircle size={18} />
          <span>{post.comments.length}</span>
        </ActionButton>
        <ActionButton onClick={() => notify('Share link copied to clipboard.', 'info')}>
          <Share2 size={18} />
          <span className="hidden sm:inline">Share</span>
        </ActionButton>
        <ActionButton active={post.saved} onClick={() => toggleSave(post.id)}>
          <Bookmark size={18} className={post.saved ? 'fill-[#ff4500] text-[#ff4500]' : ''} />
          <span className={`hidden sm:inline ${post.saved ? 'text-[#ff4500]' : ''}`}>Save</span>
        </ActionButton>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-[#edeff1] px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <Avatar name={currentUser.name} size={32} />
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
                  <Avatar name={cu?.name ?? '?'} size={32} />
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
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${
        active ? 'text-[#ff4500]' : ''
      }`}
    >
      {children}
    </button>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#f6f7f8] px-2 py-0.5 text-xs font-medium text-[#878a8c]">
      {children}
    </span>
  )
}
