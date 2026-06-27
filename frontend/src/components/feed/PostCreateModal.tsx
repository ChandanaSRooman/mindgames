import { useRef, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Avatar, Button } from '../ui'
import {
  DOMAINS,
  POST_TYPES,
  POST_TYPE_STYLES,
  type Domain,
  type PostType,
  type Visibility,
} from '../../types'

const VISIBILITIES: Visibility[] = ['All Alumni', 'My Network', 'Specific Community']

export function PostCreateModal({
  prefill,
  onClose,
}: {
  prefill?: { type?: PostType; communityId?: string }
  onClose: () => void
}) {
  const { currentUser, createPost, communities } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<PostType>(prefill?.type ?? 'Update')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<string | undefined>()
  const [domain, setDomain] = useState<Domain | ''>('')
  const [city, setCity] = useState('')
  const [batch, setBatch] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState(currentUser.company)
  const [visibility, setVisibility] = useState<Visibility>(
    prefill?.communityId ? 'Specific Community' : 'All Alumni',
  )
  const [communityId, setCommunityId] = useState(prefill?.communityId ?? '')

  const isJob = type === 'Hiring' || type === 'Open to Work'

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setImage(URL.createObjectURL(f))
  }

  function submit() {
    if (!content.trim()) return
    createPost({
      type,
      content,
      image,
      domain: domain || undefined,
      city: city || undefined,
      batch: batch ? Number(batch) : undefined,
      visibility,
      communityId: visibility === 'Specific Community' ? communityId || undefined : undefined,
      role: isJob ? role || undefined : undefined,
      company: isJob ? company || undefined : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="animate-slidein my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <h2 className="text-lg font-bold text-[#1c1c1c]">Create a post</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* Author */}
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={currentUser.name} size={44} />
            <div>
              <p className="font-semibold text-[#1c1c1c]">{currentUser.name}</p>
              <p className="text-xs text-[#878a8c]">{currentUser.designation}</p>
            </div>
          </div>

          {/* Post type selector */}
          <div className="mb-4 flex flex-wrap gap-2">
            {POST_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  type === t ? POST_TYPE_STYLES[t].classes + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-[#878a8c] hover:bg-gray-200'
                }`}
              >
                {POST_TYPE_STYLES[t].label}
              </button>
            ))}
          </div>

          {/* Job fields */}
          {isJob && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={type === 'Hiring' ? 'Role you’re hiring for' : 'Role you’re seeking'}
                className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company"
                className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
            </div>
          )}

          {/* Body */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="What do you want to share with the network?"
            className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
          />

          {/* Image preview */}
          {image && (
            <div className="relative mt-3">
              <img src={image} alt="" className="max-h-60 w-full rounded-lg object-cover" />
              <button
                onClick={() => setImage(undefined)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Tags */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as Domain | '')}
              className="rounded-lg border border-[#edeff1] px-2 py-2 text-sm text-[#1c1c1c] outline-none focus:border-[#ff4500]"
            >
              <option value="">Domain</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
            />
            <input
              value={batch}
              onChange={(e) => setBatch(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Batch"
              className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
            />
          </div>

          {/* Visibility */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {VISIBILITIES.map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  visibility === v ? 'bg-[#ff4500] text-white' : 'bg-gray-100 text-[#878a8c] hover:bg-gray-200'
                }`}
              >
                {v}
              </button>
            ))}
            {visibility === 'Specific Community' && (
              <select
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="rounded-lg border border-[#edeff1] px-2 py-1.5 text-sm outline-none focus:border-[#ff4500]"
              >
                <option value="">Choose community…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#edeff1] px-5 py-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#878a8c] hover:bg-gray-100"
          >
            <ImageIcon size={18} /> Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <Button onClick={submit} disabled={!content.trim()}>
            Post
          </Button>
        </div>
      </div>
    </div>
  )
}
