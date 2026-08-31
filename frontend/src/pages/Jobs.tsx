import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Briefcase, Check, ChevronDown, ChevronUp, CirclePause, CirclePlay, ClipboardList, Download, FileText, MapPin, MessageSquare, Paperclip, Pencil, Plus, Send, Trash2, Users, X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useLayout } from '../components/layout/LayoutContext'
import { api } from '../lib/api'
import { PostCreateModal } from '../components/feed/PostCreateModal'
import { Avatar, Button, Card, Pill } from '../components/ui'
import { roleLine, timeAgo } from '../lib/format'
import { toBase64 } from '../lib/file'
import { DOMAINS, type Domain, type JobApplicant, type Post } from '../types'

type Tab = 'Hiring' | 'Open to Work'

type ResumeAttachment = { name: string; dataBase64: string; mediaType: string }

export function Jobs() {
  const { posts, users, userById, query, sendConnect, connectionState, currentUser, applyToJob } = useApp()
  const [tab, setTab] = useState<Tab>('Hiring')
  const [domain, setDomain] = useState<Domain | 'All'>('All')
  const [showCreate, setShowCreate] = useState(false)
  const [noteModal, setNoteModal] = useState<{ userId: string; name: string } | null>(null)
  const [note, setNote] = useState('')

  const q = query.trim().toLowerCase()

  const hiring = useMemo(
    () =>
      posts
        .filter((p) => p.type === 'Hiring')
        .filter((p) => p.active !== false || p.authorId === currentUser.id)
        .filter((p) => domain === 'All' || p.domain === domain)
        .filter((p) => !q || `${p.role} ${p.company} ${p.content}`.toLowerCase().includes(q)),
    [posts, domain, q, currentUser.id],
  )

  // "Open to work" people: anyone employmentType Looking, anyone with the
  // "Open to Work" profile tag, + those who posted Open to Work.
  const openToWork = useMemo(() => {
    const fromPosts = posts.filter((p) => p.type === 'Open to Work').map((p) => p.authorId)
    const fromStatus = users
      .filter((u) => u.employmentType === 'Looking for opportunity' || u.profileTag === 'Open to Work')
      .map((u) => u.id)
    const ids = Array.from(new Set([...fromPosts, ...fromStatus])).filter((id) => id !== currentUser.id)
    return ids
      .map((id) => userById(id))
      .filter(Boolean)
      .filter((u) => domain === 'All' || u!.domain === domain)
      .filter((u) => !q || `${u!.name} ${u!.designation} ${u!.domain} ${u!.city}`.toLowerCase().includes(q)) as NonNullable<
      ReturnType<typeof userById>
    >[]
  }, [posts, users, userById, domain, q, currentUser.id])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1c1c1c]">Jobs & Opportunities</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> {tab === 'Hiring' ? 'Post a job' : "I'm open to work"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#edeff1] bg-white p-1 shadow-sm">
        {(['Hiring', 'Open to Work'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t ? 'bg-[#ff4500] text-white' : 'text-[#878a8c] hover:bg-gray-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Domain filter */}
      <div className="flex flex-wrap gap-2">
        <Pill active={domain === 'All'} onClick={() => setDomain('All')}>All Domains</Pill>
        {DOMAINS.map((d) => (
          <Pill key={d} active={domain === d} onClick={() => setDomain(d)}>{d}</Pill>
        ))}
      </div>

      {tab === 'Hiring' ? (
        <div className="flex flex-col gap-3">
          {hiring.map((p) => (
            <HiringCard
              key={p.id}
              post={p}
              isMine={p.authorId === currentUser.id}
              author={userById(p.authorId)}
              onApply={(answers, resume) => applyToJob(p.id, answers, resume)}
            />
          ))}
          {hiring.length === 0 && <Empty label="No hiring posts match your filters." />}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openToWork.map((u) => (
            <Card key={u.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} src={u.photo} size={52} to={`/profile/${u.id}`} />
                <div className="min-w-0">
                  <Link to={`/profile/${u.id}`} className="font-semibold text-[#1c1c1c] hover:underline">{u.name}</Link>
                  {roleLine(u) && <p className="truncate text-xs text-[#878a8c]">{roleLine(u)}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Open to Work</span>
                <span className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{u.domain}</span>
                {u.experienceYears > 0 && (
                  <span className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{u.experienceYears} yrs</span>
                )}
                <span className="rounded-full bg-[#f6f7f8] px-2.5 py-0.5 text-xs text-[#878a8c]">{u.city}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-[#878a8c]">{u.bio}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                disabled={connectionState(u.id) !== 'none'}
                onClick={() => {
                  setNoteModal({ userId: u.id, name: u.name })
                  setNote('')
                }}
              >
                {connectionState(u.id) === 'connected' ? 'Connected' : connectionState(u.id) === 'pending' ? 'Request sent' : 'Connect'}
              </Button>
            </Card>
          ))}
          {openToWork.length === 0 && <Empty label="No alumni open to work match your filters." />}
        </div>
      )}

      {showCreate && (
        <PostCreateModal prefill={{ type: tab }} onClose={() => setShowCreate(false)} />
      )}

      {/* Connection note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1c1c1c]">Add a note to your invitation</h2>
              <button
                onClick={() => setNoteModal(null)}
                className="text-[#878a8c] hover:text-[#1c1c1c]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-4 text-sm text-[#6b6e70]">
              Write a personal note (minimum 25 words). Root Connect members are more likely to accept connection requests that include a thoughtful message.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Hi ${noteModal.name.split(' ')[0]}, I'd love to connect with you because…`}
              maxLength={500}
              className="mb-2 w-full rounded-lg border border-[#edeff1] p-3 text-sm text-[#1c1c1c] placeholder-[#878a8c] focus:border-[#ff4500] focus:outline-none focus:ring-2 focus:ring-[#ff4500]/20"
              rows={5}
            />
            <div className="mb-4 flex justify-between">
              <span className={`text-xs font-medium ${note.split(/\s+/).filter(Boolean).length < 25 ? 'text-red-500' : 'text-green-600'}`}>
                {note.split(/\s+/).filter(Boolean).length} / 25 words
              </span>
              <span className="text-xs text-[#878a8c]">{note.length}/500</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setNoteModal(null)}
                className="flex-1 rounded-full border border-[#edeff1] px-4 py-2.5 font-medium text-[#1c1c1c] transition-colors hover:bg-[#f6f7f8]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const wordCount = note.split(/\s+/).filter(Boolean).length
                  if (noteModal && wordCount >= 25) {
                    sendConnect(noteModal.userId, note.trim())
                    setNoteModal(null)
                    setNote('')
                  }
                }}
                disabled={note.split(/\s+/).filter(Boolean).length < 25}
                className="flex-1 rounded-full bg-[#ff4500] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#d13a00] disabled:bg-[#c2c2c2] disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HiringCard({
  post: p,
  isMine,
  author,
  onApply,
}: {
  post: Post
  isMine: boolean
  author?: { id: string; name: string; company: string; photo?: string | null; employerVerified?: boolean; workEmailDomain?: string }
  onApply: (answers?: string[], resume?: ResumeAttachment) => void
}) {
  const { openChatWith } = useLayout()
  const { notify, updatePost } = useApp()
  const [applicants, setApplicants] = useState<JobApplicant[] | null>(null)
  const [showApplicants, setShowApplicants] = useState(false)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const closed = p.active === false

  const questions = p.questions ?? []
  const needsForm = questions.length > 0 || !!p.wantsResume

  // Poster-only: load the applicant list on first expand.
  async function toggleApplicants() {
    const next = !showApplicants
    setShowApplicants(next)
    if (next && applicants === null) {
      try {
        setApplicants(await api.getApplicants(p.id))
      } catch {
        setApplicants([])
      }
    }
  }

  const count = p.applicantsCount ?? 0

  async function downloadResume(a: JobApplicant) {
    try {
      const blob = await api.downloadApplicantResume(p.id, a.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = a.resumeName ?? 'resume'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not download the resume.', 'error')
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#1c1c1c]">{p.role ?? 'Open Role'}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-[#878a8c]">
            <span className="flex items-center gap-1"><Briefcase size={14} /> {p.company ?? author?.company}</span>
            {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>}
            {p.domain && <span>· {p.domain}</span>}
            {author?.employerVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1d9bf0]" title={author.workEmailDomain ? `Verified via ${author.workEmailDomain}` : 'Verified employer'}>
                <BadgeCheck size={12} /> Verified employer{author.workEmailDomain ? ` · ${author.workEmailDomain}` : ''}
              </span>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            closed ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'
          }`}
        >
          {closed ? 'Closed' : 'Hiring'}
        </span>
      </div>
      <p className="mt-3 text-sm text-[#1c1c1c]">{p.content}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Link to={`/profile/${author?.id}`} className="flex items-center gap-2 text-sm hover:underline">
          <Avatar name={author?.name ?? '?'} src={author?.photo} size={32} />
          <span className="text-[#878a8c]">Posted by <span className="font-medium text-[#1c1c1c]">{author?.name}</span> · {timeAgo(p.createdAt)}</span>
        </Link>

        {isMine ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              className="!px-3 !py-1.5 text-xs"
              onClick={() => setShowEdit(true)}
            >
              <Pencil size={14} /> Edit
            </Button>
            <Button
              variant={closed ? 'primary' : 'subtle'}
              className="!px-3 !py-1.5 text-xs"
              onClick={() => updatePost(p.id, { active: closed })}
              title={closed ? 'Start accepting applications again' : 'Stop accepting applications'}
            >
              {closed ? <><CirclePlay size={14} /> Reopen</> : <><CirclePause size={14} /> Close</>}
            </Button>
            <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={toggleApplicants}>
              <Users size={15} /> {count} applicant{count === 1 ? '' : 's'}
              <ChevronDown size={14} className={`transition-transform ${showApplicants ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        ) : p.appliedByMe ? (
          <Button variant="subtle" disabled>
            <Check size={15} /> Applied
          </Button>
        ) : (
          <Button
            disabled={closed}
            onClick={() => (needsForm ? setShowApplyForm(true) : onApply())}
          >
            <Send size={15} /> {closed ? 'Closed' : 'Apply'}
          </Button>
        )}
      </div>

      {/* Poster: edit job details, questions, resume flag */}
      {showEdit && <EditJobModal post={p} onSave={(patch) => { setShowEdit(false); updatePost(p.id, patch) }} onCancel={() => setShowEdit(false)} />}

      {/* Structured application form — shown when the poster added questions */}
      {showApplyForm && (
        <ApplyForm
          role={p.role}
          questions={questions}
          wantsResume={!!p.wantsResume}
          onCancel={() => setShowApplyForm(false)}
          onSubmit={(answers, resume) => {
            setShowApplyForm(false)
            onApply(answers, resume)
          }}
        />
      )}

      {/* Applicant list — visible only to the poster */}
      {isMine && showApplicants && (
        <div className="mt-4 border-t border-[#edeff1] pt-3">
          {applicants === null ? (
            <p className="text-sm text-[#878a8c]">Loading applicants…</p>
          ) : applicants.length === 0 ? (
            <p className="text-sm text-[#878a8c]">No applications yet. Share the post to reach more alumni.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {applicants.map((a) => (
                <div key={a.id} className="rounded-lg border border-[#edeff1] p-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.name} src={a.photo} size={36} to={`/profile/${a.id}`} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/profile/${a.id}`} className="text-sm font-semibold text-[#1c1c1c] hover:underline">
                        {a.name}
                      </Link>
                      <p className="truncate text-xs text-[#878a8c]">
                        {a.designation}{a.company ? ` · ${a.company}` : ''}{a.city ? ` · ${a.city}` : ''} · applied {timeAgo(a.appliedAt)}
                      </p>
                    </div>
                    {a.resumeName && (
                      <Button
                        variant="outline"
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => downloadResume(a)}
                        title={a.resumeName}
                      >
                        <Download size={14} /> Resume
                      </Button>
                    )}
                    <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => openChatWith(a.id)}>
                      <MessageSquare size={14} /> Message
                    </Button>
                  </div>
                  {/* Answers snapshotted at apply time (survive later edits) */}
                  {a.answers.length > 0 && (
                    <dl className="mt-2.5 space-y-1.5 border-t border-[#edeff1] pt-2.5">
                      {a.answers.map((pair) => (
                        <div key={pair.q} className="text-sm">
                          <dt className="text-xs text-[#878a8c]">{pair.q}</dt>
                          <dd className="text-[#1c1c1c]">{pair.a}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// Poster-only: edit a Hiring post's details, application questions and
// resume requirement. Existing applications keep their own Q&A snapshot.
function EditJobModal({
  post: p,
  onSave,
  onCancel,
}: {
  post: Post
  onSave: (patch: Partial<Post>) => void
  onCancel: () => void
}) {
  const [role, setRole] = useState(p.role ?? '')
  const [company, setCompany] = useState(p.company ?? '')
  const [city, setCity] = useState(p.city ?? '')
  const [content, setContent] = useState(p.content)
  const [questions, setQuestions] = useState<string[]>(p.questions ?? [])
  const [questionDraft, setQuestionDraft] = useState('')
  const [wantsResume, setWantsResume] = useState(!!p.wantsResume)

  function addQuestion(text: string) {
    const q = text.trim().slice(0, 160)
    // 20 is a silent abuse guard — the UI advertises no limit.
    if (!q || questions.length >= 20 || questions.includes(q)) return
    setQuestions((list) => [...list, q])
    setQuestionDraft('')
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((list) => {
      const j = index + dir
      if (j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const field =
    'w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onCancel}>
      <div
        className="animate-slidein my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <Pencil size={17} className="text-[#ff4500]" />
            <h2 className="font-bold text-[#1c1c1c]">Edit job post</h2>
          </div>
          <button onClick={onCancel} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className={field} />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={field} />
          </div>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={field} />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Job description"
            className={`${field} resize-none`}
          />

          <div className="rounded-xl border border-dashed border-[#edeff1] bg-[#f6f7f8] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#878a8c]">
              Questions for applicants{' '}
              {questions.length > 0 && <span className="font-bold normal-case">({questions.length})</span>}
            </p>
            {questions.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {questions.map((q, i) => (
                  <li key={q} className="flex items-center gap-2 rounded-lg border border-[#edeff1] bg-white px-3 py-1.5 text-sm text-[#1c1c1c]">
                    <span className="text-xs font-bold text-[#ff4500]">{i + 1}.</span>
                    <span className="flex-1">{q}</span>
                    <button
                      onClick={() => moveQuestion(i, -1)}
                      disabled={i === 0}
                      className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100 hover:text-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move up"
                      aria-label={`Move question up: ${q}`}
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => moveQuestion(i, 1)}
                      disabled={i === questions.length - 1}
                      className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100 hover:text-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move down"
                      aria-label={`Move question down: ${q}`}
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      onClick={() => setQuestions((list) => list.filter((x) => x !== q))}
                      className="rounded-full p-1 text-[#878a8c] hover:bg-red-50 hover:text-red-500"
                      title="Delete this question"
                      aria-label={`Delete question: ${q}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addQuestion(questionDraft)
                  }
                }}
                placeholder="Add a question…"
                className={`${field} flex-1 bg-white`}
              />
              <button
                onClick={() => addQuestion(questionDraft)}
                disabled={!questionDraft.trim()}
                className="flex items-center gap-1 rounded-lg bg-[#ff4500] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ff6534] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} /> Add
              </button>
            </div>
            <p className="mt-2 text-xs text-[#878a8c]">
              Changing questions only affects new applications — existing ones keep the
              questions they answered.
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2.5 border-t border-[#edeff1] pt-2.5">
              <input
                type="checkbox"
                checked={wantsResume}
                onChange={(e) => setWantsResume(e.target.checked)}
                className="h-4 w-4 accent-[#ff4500]"
              />
              <span className="text-sm text-[#1c1c1c]">Require a resume from applicants</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#edeff1] px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={!content.trim()}
            onClick={() => onSave({ role, company, city, content: content.trim(), questions, wantsResume })}
          >
            <Check size={15} /> Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// Modal asking the applicant to answer the poster's questions (and attach a
// resume when requested) before applying.
function ApplyForm({
  role,
  questions,
  wantsResume,
  onCancel,
  onSubmit,
}: {
  role?: string
  questions: string[]
  wantsResume: boolean
  onCancel: () => void
  onSubmit: (answers: string[], resume?: ResumeAttachment) => void
}) {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ''))
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const complete = answers.every((a) => a.trim()) && (!wantsResume || !!file)

  function pickFile(f: File) {
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      setFileError('Please attach a PDF or Word (.docx) file.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setFileError('File is too large — please keep it under 5MB.')
      return
    }
    setFileError(null)
    setFile(f)
  }

  async function submit() {
    setSending(true)
    let resume: ResumeAttachment | undefined
    if (file) {
      const mediaType =
        file.type ||
        (/\.docx$/i.test(file.name)
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf')
      resume = { name: file.name, dataBase64: await toBase64(file), mediaType }
    }
    onSubmit(answers.map((a) => a.trim()), resume)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onCancel}>
      <div
        className="animate-slidein my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-[#ff4500]" />
            <h2 className="font-bold text-[#1c1c1c]">Apply{role ? ` — ${role}` : ''}</h2>
          </div>
          <button onClick={onCancel} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {questions.length > 0 && (
            <p className="text-sm text-[#878a8c]">
              The poster asks every applicant to answer these questions:
            </p>
          )}
          {questions.map((q, i) => (
            <div key={q}>
              <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">
                {i + 1}. {q}
              </label>
              <textarea
                value={answers[i]}
                onChange={(e) =>
                  setAnswers((list) => list.map((a, j) => (j === i ? e.target.value.slice(0, 1000) : a)))
                }
                rows={2}
                placeholder="Your answer…"
                className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
            </div>
          ))}

          {wantsResume && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">
                Resume <span className="text-[#ff4500]">*</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#edeff1] bg-[#f6f7f8] px-3 py-2.5 text-sm hover:border-[#ff6534]">
                {file ? (
                  <>
                    <FileText size={16} className="shrink-0 text-[#ff4500]" />
                    <span className="min-w-0 flex-1 truncate text-[#1c1c1c]">{file.name}</span>
                    <span className="text-xs text-[#878a8c]">change</span>
                  </>
                ) : (
                  <>
                    <Paperclip size={16} className="shrink-0 text-[#878a8c]" />
                    <span className="text-[#878a8c]">Attach your resume (PDF or .docx)</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.docx"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) pickFile(f)
                  }}
                />
              </label>
              {fileError && <p className="mt-1 text-sm text-red-500">{fileError}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#edeff1] px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={!complete || sending} onClick={submit}>
            <Send size={15} /> {sending ? 'Submitting…' : 'Submit application'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
      {label}
    </div>
  )
}
