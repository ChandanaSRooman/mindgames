import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { Avatar } from '../ui'
import { timeAgo } from '../../lib/format'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { useUpcomingEvents } from '../../hooks/useUpcomingEvents'
import { DEFAULT_SORT, SORT_MODES, sortPostsBySortMode, type SortMode } from '../../lib/postSort'
import type { Post, User } from '../../types'

function PostCard({ p, author }: { p: Post; author: User | undefined }) {
  return (
    // Deep-links to the post in the feed below; Home.tsx handles the #post-<id>
    // hash by scrolling to it and briefly highlighting it.
    <Link
      to={`/home#post-${p.id}`}
      className="flex items-start gap-2.5 bg-white border border-[#e0e0e0] p-2.5 hover:border-[#ff4500] transition-all duration-300 group"
    >
      <Avatar name={author?.name ?? '?'} src={author?.photo} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-black">{author?.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-[#333] leading-snug">{p.content}</p>
        <div className="mt-1.5 flex gap-3 text-[10px] text-[#666]">
          <span>❤️ {p.likes || 0}</span>
          <span>💬 {p.comments?.length || 0}</span>
          <span>{timeAgo(p.createdAt)}</span>
        </div>
      </div>
    </Link>
  )
}

export function HomeRightSidebar() {
  const { posts, currentUser, connectionIds, userById } = useApp()
  // Scoped to this sidebar's own widgets — the main feed has its own ordering
  // (network posts from the last 48h) and deliberately does not follow this.
  const [sort, setSort] = useState<SortMode>(DEFAULT_SORT)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const leaders = useLeaderboard()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const topPosts = useMemo(
    () => sortPostsBySortMode(posts, sort).slice(0, 3),
    [posts, sort]
  )

  const trendingPostsData = useMemo(
    () => sortPostsBySortMode(posts, 'Hot').slice(0, 3),
    [posts]
  )

  const trendingTopics = useMemo(() => {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const recentPosts = posts.filter((p) => +new Date(p.createdAt) > sevenDaysAgo)
    const topicCounts = new Map<string, number>()
    recentPosts.forEach((p) => {
      if (p.domain) topicCounts.set(p.domain, (topicCounts.get(p.domain) ?? 0) + 1)
    })
    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [posts])

  const postsForYou = useMemo(() => {
    return posts
      .filter((p) => p.authorId !== currentUser.id)
      .map((p) => {
        let score = 0
        if (p.domain === currentUser.domain) score += 3
        if (p.city === currentUser.city) score += 2
        if (connectionIds.includes(p.authorId)) score += 4
        return { post: p, score }
      })
      .sort((a, b) => b.score - a.score || +new Date(b.post.createdAt) - +new Date(a.post.createdAt))
      .slice(0, 3)
      .map((x) => x.post)
  }, [posts, currentUser.id, currentUser.domain, currentUser.city, connectionIds])

  const nextEvents = useUpcomingEvents(2)

  return (
    <aside className="fixed bottom-0 right-[var(--shell-gutter)] top-14 hidden w-[300px] overflow-y-auto px-4 py-4 xl:block bg-[#f5f5f5]">
      <div className="flex flex-col gap-3.5">
        {/* Sort filter */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between bg-[#ff4500] border border-[#ff4500] px-3 py-2 text-sm font-bold text-white hover:bg-[#ff6534] transition-all duration-200"
          >
            <span>{sort}</span>
            <ChevronDown size={14} className={`transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && (
            <div className="absolute top-10 left-0 right-0 z-10 border border-[#e0e0e0] bg-white shadow-lg">
              {SORT_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSort(mode)
                    setShowDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm font-medium transition-all duration-200 text-black ${
                    sort === mode
                      ? 'bg-orange-100 font-bold border-l-2 border-[#ff4500]'
                      : 'hover:bg-[#f9f9f9]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top posts */}
        {topPosts.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-black">{sort}</h3>
            <div className="flex flex-col gap-2">
              {topPosts.map((p) => (
                <PostCard key={p.id} p={p} author={userById(p.authorId)} />
              ))}
            </div>
          </div>
        )}

        {/* Trending posts */}
        {trendingPostsData.length > 0 && sort !== 'Hot' && (
          <div>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-black">🔥 Trending Now</h3>
            <div className="flex flex-col gap-2">
              {trendingPostsData.map((p) => (
                <PostCard key={p.id} p={p} author={userById(p.authorId)} />
              ))}
            </div>
          </div>
        )}

        {/* Trending topics */}
        {trendingTopics.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-black">Trending Topics</h3>
            <div className="flex flex-wrap gap-1.5">
              {trendingTopics.map(([topic]) => (
                <div
                  key={topic}
                  className="bg-white border border-[#e0e0e0] px-2.5 py-1.5 text-[10px] font-semibold text-black cursor-default transition-all duration-300"
                >
                  {topic}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts for you */}
        {postsForYou.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-black">For You</h3>
            <div className="flex flex-col gap-2">
              {postsForYou.map((p) => (
                <PostCard key={p.id} p={p} author={userById(p.authorId)} />
              ))}
            </div>
          </div>
        )}

        {/* Top contributors */}
        {leaders.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-black">Top Contributors</h3>
            <div className="flex flex-col gap-1.5">
              {leaders.slice(0, 4).map((l, i) => (
                <Link
                  key={l.id}
                  to={`/profile/${l.id}`}
                  className="group flex items-center gap-2.5 bg-white border border-[#e0e0e0] px-2.5 py-2 hover:border-[#ff4500] transition-all duration-300"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-[#ffa500]' : i === 1 ? 'bg-[#c0c0c0]' : i === 2 ? 'bg-[#cd7f32]' : 'bg-[#999]'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-black">
                      {l.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-[#ff4500]">{l.points}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming events */}
        {nextEvents.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-black">Events</h3>
            <div className="flex flex-col gap-1.5">
              {nextEvents.map((e) => (
                <Link
                  key={e.id}
                  to="/events"
                  className="group bg-white border border-[#e0e0e0] p-2.5 text-xs hover:border-[#ff4500] transition-all duration-300"
                >
                  <p className="font-semibold text-black">{e.title}</p>
                  <p className="mt-0.5 text-[10px] text-[#666]">
                    {new Date(e.startsAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 px-1 text-[10px] text-[#999]">
          Root Connect · Alumni Network
        </div>
      </div>
    </aside>
  )
}
