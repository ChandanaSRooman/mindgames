import { useEffect, useMemo } from 'react'
import { useApp } from '../store/AppStore'
import { CreatePostBox } from '../components/feed/CreatePostBox'
import { PostCard } from '../components/feed/PostCard'
import { matchesPostQuery } from '../lib/search'

export function Home() {
  const { posts, users, query } = useApp()

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
    // Sort by newest first
    list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    // Pinned Rooman announcements always float to the top.
    return [...list].sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false))
  }, [posts, users, query])

  return (
    <div className="flex flex-col gap-2">
      <CreatePostBox />

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
