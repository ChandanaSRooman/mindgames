import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { CreatePostBox } from '../components/feed/CreatePostBox'
import { PostCard } from '../components/feed/PostCard'
import { matchesPostQuery } from '../lib/search'

/** Feed window: posts from your network published in the last 48 hours. */
const FEED_WINDOW_MS = 48 * 60 * 60 * 1000

export function Home() {
  const { posts, users, query, connectionIds } = useApp()

  // Post links (/home#post-<id>) scroll to the post once the feed is in — both
  // when arriving from outside and when the hash changes while already here
  // (e.g. clicking a preview card in the right sidebar), hence the hash dep.
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash || posts.length === 0) return
    const el = document.getElementById(hash.slice(1))
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-[#ff4500]')
    const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-[#ff4500]'), 2500)
    return () => {
      clearTimeout(timer)
      el.classList.remove('ring-2', 'ring-[#ff4500]')
    }
  }, [hash, posts.length])

  const visible = useMemo(() => {
    const matching = posts.filter((p) => matchesPostQuery(p, users, query))
    const byNewest = (a: (typeof matching)[number], b: (typeof matching)[number]) =>
      +new Date(b.createdAt) - +new Date(a.createdAt)

    // Pinned Rooman announcements are official and always shown, regardless of
    // who posted them or how old they are.
    const pinned = matching.filter((p) => p.pinned).sort(byNewest)
    const rest = matching.filter((p) => !p.pinned)

    const fromNetwork = rest.filter((p) => connectionIds.includes(p.authorId))
    const cutoff = Date.now() - FEED_WINDOW_MS
    const recentFromNetwork = fromNetwork.filter((p) => +new Date(p.createdAt) >= cutoff)

    // Primary rule: your network's last 48 hours. Widen only when that would
    // leave the feed empty — a blank feed reads as broken, and new members with
    // no connections yet would otherwise never see anything.
    const body =
      recentFromNetwork.length > 0 ? recentFromNetwork : fromNetwork.length > 0 ? fromNetwork : rest

    return [...pinned, ...[...body].sort(byNewest)]
  }, [posts, users, query, connectionIds])

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
