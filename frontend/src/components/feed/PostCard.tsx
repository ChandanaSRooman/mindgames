import { useState } from 'react'
import { Heart, MessageSquare, Share2 } from 'lucide-react'
import type { Post } from '../../types'
import { Card } from '../ui'
import { StatusBadge } from '../ui/StatusBadge'

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false)

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-700 text-sm font-semibold text-teal-300">
          {initials(post.authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-slate-100">{post.authorName}</span>
            <span className="text-xs text-slate-500">· {post.authorRole}</span>
            <span className="text-xs text-slate-500">· {relativeTime(post.createdAt)}</span>
          </div>
          {post.authorTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {post.authorTags.map((t) => (
                <StatusBadge key={t} tag={t} />
              ))}
            </div>
          )}
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{post.content}</p>

          <div className="mt-4 flex items-center gap-5 text-sm text-slate-400">
            <button
              onClick={() => setLiked((v) => !v)}
              className={`inline-flex items-center gap-1.5 transition-colors ${liked ? 'text-rose-400' : 'hover:text-slate-200'}`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              {post.likes + (liked ? 1 : 0)}
            </button>
            <button className="inline-flex items-center gap-1.5 hover:text-slate-200">
              <MessageSquare size={16} /> Comment
            </button>
            <button className="inline-flex items-center gap-1.5 hover:text-slate-200">
              <Share2 size={16} /> Share
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
