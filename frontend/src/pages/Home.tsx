import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import { CreatePostBox } from '../components/feed/CreatePostBox'
import { PostCard } from '../components/feed/PostCard'
import { matchesPostQuery } from '../lib/search'

type Sort = 'Latest' | 'Top' | 'For You'
const SORTS: Sort[] = ['Latest', 'Top', 'For You']

export function Home() {
  const { posts, users, currentUser, query } = useApp()
  const [sort, setSort] = useState<Sort>('Latest')

  // Shared post links (/home#post-<id>) scroll to the post once the feed is in.
  useEffect(() => {
    if (!window.location.hash || posts.length === 0) return
    const el = document.getElementById(window.location.hash.slice(1))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-[#ff4500]')
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#ff4500]'), 2500)
    }
  }, [posts.length])

  const visible = useMemo(() => {
    let list = posts.filter((p) => matchesPostQuery(p, users, query))
    if (sort === 'Top') {
      list = [...list].sort((a, b) => b.likes - a.likes)
    } else if (sort === 'For You') {
      list = [...list].sort((a, b) => {
        const score = (x: typeof a) => (x.domain === currentUser.domain ? 1 : 0)
        return score(b) - score(a) || +new Date(b.createdAt) - +new Date(a.createdAt)
      })
    } else {
      list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    }
    // Pinned Rooman announcements always float to the top.
    return [...list].sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false))
  }, [posts, users, query, sort, currentUser.domain])

  return (
    <div className="flex flex-col gap-4">
      <CreatePostBox />

      {/* Sort bar */}
      <div className="flex items-center gap-1 rounded-xl border border-[#edeff1] bg-white px-2 py-1.5 shadow-sm">
        {SORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              sort === s ? 'bg-orange-50 text-[#ff4500]' : 'text-[#878a8c] hover:bg-gray-100'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {visible.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}

      {visible.length === 0 && (
        <div className="rounded-xl border border-[#edeff1] bg-white py-16 text-center text-[#878a8c] shadow-sm">
          No posts match “{query}”.
        </div>
      )}
    </div>
  )
}
