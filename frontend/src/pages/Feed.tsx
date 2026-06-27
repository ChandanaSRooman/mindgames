import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Inbox } from 'lucide-react'
import type { Post, StatusTag } from '../types'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { Card } from '../components/ui'
import { PostComposer } from '../components/feed/PostComposer'
import { PostCard } from '../components/feed/PostCard'
import { StatusFilterSidebar } from '../components/feed/StatusFilterSidebar'

export function Feed() {
  const { notify, profile } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [filters, setFilters] = useState<StatusTag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getFeed()
      .then(setPosts)
      .catch(() => notify('Could not load the feed. Is the backend running?', 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  const visible = useMemo(
    () => (filters.length === 0 ? posts : posts.filter((p) => p.authorTags.some((t) => filters.includes(t)))),
    [posts, filters],
  )

  function toggleFilter(t: StatusTag) {
    setFilters((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  async function createPost(content: string, tags: StatusTag[]) {
    try {
      const post = await api.createPost(content, tags)
      setPosts((prev) => [{ ...post, authorName: profile.displayName, authorRole: profile.role }, ...prev])
      notify('Posted to the network.', 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not post', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-10 border-b border-navy-800 bg-navy-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-3.5 sm:px-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 text-navy-950">
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Network Feed</p>
            <p className="text-xs text-slate-400">Rooman Alumni Network</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <PostComposer defaultTags={profile.tags} onPost={createPost} />

          {loading ? (
            <Card className="p-10 text-center text-slate-500">Loading feed…</Card>
          ) : visible.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <Inbox size={28} className="text-slate-600" />
              <p className="text-sm text-slate-400">
                {filters.length ? 'No posts match these filters.' : 'No posts yet — be the first to share.'}
              </p>
            </Card>
          ) : (
            visible.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>

        {/* Sidebar — moves above the feed on small screens via order */}
        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-20">
            <StatusFilterSidebar active={filters} onToggle={toggleFilter} onClear={() => setFilters([])} />
          </div>
        </aside>
      </div>
    </div>
  )
}
