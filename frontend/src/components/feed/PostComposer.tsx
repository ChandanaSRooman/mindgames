import { useState } from 'react'
import { Send } from 'lucide-react'
import type { StatusTag } from '../../types'
import { STATUS_TAGS } from '../../types'
import { Button, Card } from '../ui'
import { StatusToggle } from '../ui/StatusBadge'

export function PostComposer({
  defaultTags,
  onPost,
}: {
  defaultTags: StatusTag[]
  onPost: (content: string, tags: StatusTag[]) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<StatusTag[]>(defaultTags)
  const [posting, setPosting] = useState(false)

  function toggle(t: StatusTag) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  async function submit() {
    if (!content.trim()) return
    setPosting(true)
    try {
      await onPost(content.trim(), tags)
      setContent('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card className="p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Share an update, a job opening, or a mentorship request…"
        className="w-full resize-none rounded-lg border border-navy-600 bg-navy-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TAGS.map((t) => (
            <StatusToggle key={t} tag={t} active={tags.includes(t)} onToggle={() => toggle(t)} />
          ))}
        </div>
        <Button icon={<Send size={16} />} onClick={submit} loading={posting} disabled={!content.trim()}>
          Post
        </Button>
      </div>
    </Card>
  )
}
