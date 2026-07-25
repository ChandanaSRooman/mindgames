import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, ExternalLink, Megaphone, Pin, X, XCircle } from 'lucide-react'
import type { Alumni, ContactRow, PendingCommunity, PendingEvent, StartupApplication } from '../types'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { AdminLayout, type AdminView } from '../components/admin/AdminLayout'
import { StatBar } from '../components/admin/StatBar'
import { CsvUpload } from '../components/admin/CsvUpload'
import { AddUserForm } from '../components/admin/AddUserForm'
import { AlumniTable } from '../components/admin/AlumniTable'
import { Avatar, Button, Card } from '../components/ui'
import { timeAgo } from '../lib/format'

// NOTE: Restyled to the light Root Connect theme. All api.* invite/alumni LOGIC
// is unchanged from the original implementation.

export function AdminDashboard() {
  const { notify } = useApp()
  const [view, setView] = useState<AdminView>('dashboard')
  const [alumni, setAlumni] = useState<Alumni[]>([])
  const [preview, setPreview] = useState<ContactRow[]>([])
  const [invitesSent, setInvitesSent] = useState(0)

  useEffect(() => {
    api
      .getAlumni()
      .then(setAlumni)
      .catch(() => notify('Could not reach the API. Is the backend running on :4000?', 'error'))
  }, [notify])

  const mentors = useMemo(() => alumni.filter((a) => a.statusTags.includes('Can mentor')).length, [alumni])

  async function commitPreview() {
    const valid = preview.filter((r) => r.valid)
    if (valid.length === 0) return notify('No valid rows to import.', 'error')
    try {
      const { added, skipped } = await api.bulkAddAlumni(valid)
      setAlumni((prev) => [...added, ...prev])
      setPreview([])
      notify(`Imported ${added.length} alumni${skipped.length ? `, skipped ${skipped.length}` : ''}.`, 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Import failed', 'error')
    }
  }

  async function addOne(row: { name: string; phone: string; email: string }) {
    try {
      const created = await api.addAlumni(row)
      setAlumni((prev) => [created, ...prev])
      notify(`Added ${created.name}.`, 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not add alumnus', 'error')
    }
  }

  return (
    <AdminLayout
      view={view}
      onViewChange={setView}
      stats={<StatBar total={alumni.length} mentors={mentors} invitesSent={invitesSent} />}
    >
      {view === 'dashboard' && (
        <div className="space-y-6">
          <OverviewPanel />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Bulk Upload (CSV)</h2>
              <p className="mb-4 text-sm text-[#878a8c]">Import a contact list — we keep only Name, Phone and Email.</p>
              <CsvUpload onParsed={setPreview} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Add Individually</h2>
              <p className="mb-4 text-sm text-[#878a8c]">Quick single-user entry.</p>
              <AddUserForm onAdd={addOne} />
            </Card>
          </div>

          {preview.length > 0 && <PreviewTable rows={preview} onImport={commitPreview} onDiscard={() => setPreview([])} />}

          <AlumniTable alumni={alumni} onInvitesSent={(n) => setInvitesSent((s) => s + n)} />
        </div>
      )}

      {view === 'directory' && (
        <AlumniTable alumni={alumni} onInvitesSent={(n) => setInvitesSent((s) => s + n)} />
      )}

      {view === 'announcements' && <AnnouncementsPanel />}

      {view === 'mentors' && <MentorApprovalsPanel />}

      {view === 'startups' && <StartupApplicationsPanel />}

      {view === 'communities' && <CommunityApprovalsPanel />}

      {view === 'events' && <EventApprovalsPanel />}

      {view === 'reports' && <ReportsPanel />}
      {view === 'settings' && <SettingsPanel />}
    </AdminLayout>
  )
}

// Publish official Rooman content: pinned announcements (broadcast) or quiet
// news updates. Only admin-authored posts appear on News & Updates.
function AnnouncementsPanel() {
  const { announce, unpinAnnouncement, posts, userById } = useApp()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'announcement' | 'news'>('announcement')
  const pinned = posts.filter((p) => p.pinned)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
          <Megaphone size={18} className="text-[#ff4500]" /> Publish to the Network
        </h2>
        <p className="mb-3 mt-1 text-sm text-[#878a8c]">
          Official content shows on News &amp; Updates. Member posts never do.
        </p>

        {/* Mode */}
        <div className="mb-3 flex flex-col gap-2">
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${mode === 'announcement' ? 'border-[#ff4500] bg-orange-50' : 'border-[#edeff1]'}`}>
            <input type="radio" className="mt-0.5 accent-[#ff4500]" checked={mode === 'announcement'} onChange={() => setMode('announcement')} />
            <span>
              <span className="block text-sm font-semibold text-[#1c1c1c]">📌 Announcement</span>
              <span className="block text-xs text-[#878a8c]">Pinned to the top of every feed + notification to all members. For important news.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${mode === 'news' ? 'border-[#ff4500] bg-orange-50' : 'border-[#edeff1]'}`}>
            <input type="radio" className="mt-0.5 accent-[#ff4500]" checked={mode === 'news'} onChange={() => setMode('news')} />
            <span>
              <span className="block text-sm font-semibold text-[#1c1c1c]">📰 News update</span>
              <span className="block text-xs text-[#878a8c]">Appears on News &amp; Updates and in the feed — no pin, no notification blast.</span>
            </span>
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. Alumni Summit 2026 registrations are now open!"
          className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        />
        <Button
          className="mt-3"
          icon={<Pin size={15} />}
          disabled={!text.trim()}
          onClick={() => { announce(text, mode === 'announcement'); setText('') }}
        >
          {mode === 'announcement' ? 'Pin Announcement' : 'Publish News Update'}
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">Live Pinned Announcements</h2>
        <div className="mt-3 flex flex-col gap-3">
          {pinned.map((p) => (
            <div key={p.id} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
              <p className="text-sm text-[#1c1c1c]">{p.content}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-[#878a8c]">{userById(p.authorId)?.name} · {timeAgo(p.createdAt)}</p>
                <button
                  onClick={() => unpinAnnouncement(p.id)}
                  className="text-xs font-semibold text-[#ff4500] hover:underline"
                >
                  Unpin
                </button>
              </div>
            </div>
          ))}
          {pinned.length === 0 && <p className="text-sm text-[#878a8c]">No announcements pinned yet.</p>}
        </div>
      </Card>
    </div>
  )
}

// Approve / decline alumni who applied to become mentors.
function MentorApprovalsPanel() {
  const { pendingMentorIds, userById, approveMentor, declineMentor, users, currentUser } = useApp()
  const pending = pendingMentorIds.map(userById).filter(Boolean) as NonNullable<ReturnType<typeof userById>>[]
  const activeMentors = users.filter((u) => u.isMentor && u.id !== currentUser.id && u.id !== 'rooman')

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">Pending Mentor Applications ({pending.length})</h2>
        <div className="mt-3 flex flex-col gap-3">
          {pending.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-lg border border-[#edeff1] p-3">
              <Avatar name={u.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#1c1c1c]">{u.name}</p>
                <p className="truncate text-xs text-[#878a8c]">{u.designation} · {u.company} · {u.domain}</p>
              </div>
              <Button icon={<Check size={15} />} className="!px-3 !py-1.5 text-xs" onClick={() => approveMentor(u.id)}>
                Approve
              </Button>
              <button onClick={() => declineMentor(u.id)} className="rounded-full p-2 text-[#878a8c] hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-[#878a8c]">No pending applications. 🎉</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">Active Mentors ({activeMentors.length})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {activeMentors.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-lg border border-[#edeff1] p-3">
              <Avatar name={u.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium text-[#1c1c1c]">{u.name}</p>
                <p className="truncate text-xs text-[#878a8c]">₹{u.mentorRate?.toLocaleString('en-IN')}/hr · {u.sessionsConducted} sessions</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

type AdminStats = Awaited<ReturnType<typeof api.getAdminStats>>

// Network-wide overview: who joined, engagement, and what needs attention.
function OverviewPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api.getAdminStats().then(setStats, () => {})
  }, [])

  if (!stats) return null

  const tiles: Array<{ label: string; value: string | number; hint?: string }> = [
    { label: 'Members joined', value: stats.members, hint: `+${stats.membersThisWeek} this week` },
    { label: 'Invites sent', value: `${stats.invited}/${stats.invitees}`, hint: 'invited / directory' },
    { label: 'Posts', value: stats.posts, hint: `${stats.comments} comments` },
    { label: 'Communities', value: stats.communities },
    { label: 'Sessions', value: stats.sessions.upcoming + stats.sessions.completed, hint: `${stats.sessions.requested} awaiting mentor` },
    { label: 'Startup applications', value: stats.startups },
    { label: 'Job applications', value: stats.jobApplications },
    { label: 'Mentor approvals pending', value: stats.pendingMentorApps },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-2xl font-extrabold text-[#ff4500]">{t.value}</p>
            <p className="mt-0.5 text-sm font-medium text-[#1c1c1c]">{t.label}</p>
            {t.hint && <p className="text-xs text-[#878a8c]">{t.hint}</p>}
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-bold text-[#1c1c1c]">Recently Joined</h2>
        <div className="flex flex-col gap-2">
          {stats.recentMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-[#edeff1] p-2.5">
              <Avatar name={m.name} size={36} />
              <div className="min-w-0 flex-1">
                <Link to={`/profile/${m.id}`} className="text-sm font-semibold text-[#1c1c1c] hover:underline">
                  {m.name}
                </Link>
                <p className="truncate text-xs text-[#878a8c]">
                  {m.email}{m.city ? ` · ${m.city}` : ''}
                </p>
              </div>
              <span className="text-xs text-[#878a8c]">joined {timeAgo(m.joinedAt)}</span>
            </div>
          ))}
          {stats.recentMembers.length === 0 && (
            <p className="text-sm text-[#878a8c]">No members yet — send some invites below.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

// Member-created communities awaiting acceptance.
function CommunityApprovalsPanel() {
  const { notify } = useApp()
  const [pending, setPending] = useState<PendingCommunity[] | null>(null)

  useEffect(() => {
    api.getPendingCommunities().then(setPending, () => setPending([]))
  }, [])

  function act(id: string, action: 'approve' | 'reject') {
    const call = action === 'approve' ? api.approveCommunity(id) : api.rejectCommunity(id)
    call.then(
      () => {
        setPending((list) => (list ?? []).filter((c) => c.id !== id))
        notify(action === 'approve' ? 'Community approved — it is now live.' : 'Community request declined.', action === 'approve' ? 'success' : 'info')
      },
      () => notify('Could not update the community.', 'error'),
    )
  }

  if (pending === null) return <p className="text-sm text-[#878a8c]">Loading pending communities…</p>

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">Pending Communities ({pending.length})</h2>
        <p className="mt-1 text-sm text-[#878a8c]">
          Member-created communities go live only after your approval. Creators are notified either way.
        </p>
      </Card>

      {pending.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-lg font-black text-white`}>
                {c.name[0]}
              </span>
              <div>
                <p className="font-bold text-[#1c1c1c]">{c.name}</p>
                <p className="text-xs text-[#878a8c]">{c.category} · #{c.tag} · requested by {c.creatorName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="!px-4 !py-2 text-xs" onClick={() => act(c.id, 'approve')}>
                <Check size={14} /> Approve
              </Button>
              <Button variant="subtle" className="!px-4 !py-2 text-xs" onClick={() => act(c.id, 'reject')}>
                <X size={14} /> Decline
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#1c1c1c]">{c.description}</p>
        </Card>
      ))}
      {pending.length === 0 && (
        <Card className="py-12 text-center text-sm text-[#878a8c]">No pending communities. 🎉</Card>
      )}
    </div>
  )
}

// Member-created events awaiting acceptance.
function EventApprovalsPanel() {
  const { notify } = useApp()
  const [pending, setPending] = useState<PendingEvent[] | null>(null)

  useEffect(() => {
    api.getPendingEvents().then(setPending, () => setPending([]))
  }, [])

  function act(id: string, action: 'approve' | 'reject') {
    const call = action === 'approve' ? api.approveEvent(id) : api.rejectEvent(id)
    call.then(
      () => {
        setPending((list) => (list ?? []).filter((e) => e.id !== id))
        notify(
          action === 'approve' ? 'Event approved — the network has been notified.' : 'Event request declined.',
          action === 'approve' ? 'success' : 'info',
        )
      },
      () => notify('Could not update the event.', 'error'),
    )
  }

  if (pending === null) return <p className="text-sm text-[#878a8c]">Loading pending events…</p>

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">Pending Events ({pending.length})</h2>
        <p className="mt-1 text-sm text-[#878a8c]">
          Member-created events go live only after your approval. Hosts are notified either way.
        </p>
      </Card>

      {pending.map((e) => {
        const start = new Date(e.startsAt)
        return (
          <Card key={e.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-50 text-[#ff4500]">
                  <span className="text-[10px] font-bold uppercase">{start.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  <span className="text-lg leading-none font-extrabold">{start.getDate()}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#1c1c1c]">{e.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.isPaid ? 'bg-orange-100 text-[#ff4500]' : 'bg-green-100 text-green-700'}`}>
                      {e.isPaid ? `Paid · ₹${(e.price ?? 0).toLocaleString('en-IN')}` : 'Free'}
                    </span>
                  </div>
                  <p className="text-xs text-[#878a8c]">
                    {start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {start.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    {e.location ? ` · ${e.location}` : ''} · requested by {e.creatorName}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="!px-4 !py-2 text-xs" onClick={() => act(e.id, 'approve')}>
                  <Check size={14} /> Approve
                </Button>
                <Button variant="subtle" className="!px-4 !py-2 text-xs" onClick={() => act(e.id, 'reject')}>
                  <X size={14} /> Decline
                </Button>
              </div>
            </div>
            {e.description && <p className="mt-3 text-sm text-[#1c1c1c]">{e.description}</p>}
          </Card>
        )
      })}
      {pending.length === 0 && (
        <Card className="py-12 text-center text-sm text-[#878a8c]">No pending events. 🎉</Card>
      )}
    </div>
  )
}

// StartupVarsity applications with founder contact details for follow-up.
function StartupApplicationsPanel() {
  const [apps, setApps] = useState<StartupApplication[] | null>(null)

  useEffect(() => {
    api.getStartupApplications().then(setApps, () => setApps([]))
  }, [])

  if (apps === null) return <p className="text-sm text-[#878a8c]">Loading applications…</p>

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">
          StartupVarsity Applications ({apps.length})
        </h2>
        <p className="mt-1 text-sm text-[#878a8c]">
          Ideas submitted from the network. Reach out to founders directly, or process them at{' '}
          <a href="https://www.startupvarsity.com" target="_blank" rel="noopener noreferrer" className="font-medium text-[#ff4500] hover:underline">
            startupvarsity.com
          </a>.
        </p>
      </Card>

      {apps.map((a) => (
        <Card key={a.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-[#1c1c1c]">{a.name}</p>
              <p className="text-xs text-[#878a8c]">
                {a.domain} · {a.stage} · team of {a.teamSize} · applied {timeAgo(a.appliedAt)}
              </p>
            </div>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{a.stage}</span>
          </div>
          <p className="mt-3 text-sm text-[#1c1c1c]">{a.description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edeff1] pt-3">
            <div className="flex items-center gap-2">
              <Avatar name={a.founderName} size={36} />
              <div>
                <p className="text-sm font-semibold text-[#1c1c1c]">{a.founderName}</p>
                <p className="text-xs text-[#878a8c]">
                  {a.founderEmail}
                  {a.founderPhone ? ` · ${a.founderPhone}` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`mailto:${a.founderEmail}?subject=${encodeURIComponent(`StartupVarsity — ${a.name}`)}`}
                className="rounded-full border border-[#edeff1] px-4 py-2 text-sm font-semibold text-[#1c1c1c] hover:border-[#ff4500] hover:text-[#ff4500]"
              >
                Email founder
              </a>
              <Link
                to={`/profile/${a.founderId}`}
                className="rounded-full bg-[#ff4500] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff6534]"
              >
                View profile
              </Link>
            </div>
          </div>
        </Card>
      ))}
      {apps.length === 0 && (
        <Card className="py-12 text-center text-sm text-[#878a8c]">No applications yet.</Card>
      )}
    </div>
  )
}

function PreviewTable({
  rows,
  onImport,
  onDiscard,
}: {
  rows: ContactRow[]
  onImport: () => void
  onDiscard: () => void
}) {
  const validCount = rows.filter((r) => r.valid).length
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edeff1] px-4 py-3">
        <h3 className="text-sm font-bold text-[#1c1c1c]">
          Parsed Preview — <span className="text-green-600">{validCount} valid</span>
          {rows.length - validCount > 0 && <span className="text-red-500"> · {rows.length - validCount} flagged</span>}
        </h3>
        <div className="flex gap-2">
          <button onClick={onDiscard} className="rounded-lg px-3 py-2 text-sm text-[#878a8c] hover:bg-gray-100">
            Discard
          </button>
          <button onClick={onImport} className="rounded-full bg-[#ff4500] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff6534]">
            Import {validCount}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#edeff1] text-xs uppercase tracking-wide text-[#878a8c]">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 text-center font-medium">Valid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#edeff1]">
                <td className="px-4 py-2 text-[#1c1c1c]">{r.name || <span className="text-red-500">missing</span>}</td>
                <td className="px-4 py-2 text-[#878a8c]">{r.phone || '—'}</td>
                <td className="px-4 py-2 text-[#878a8c]">{r.email || <span className="text-red-500">missing</span>}</td>
                <td className="px-4 py-2 text-center">
                  {r.valid ? (
                    <CheckCircle2 size={16} className="mx-auto text-green-600" />
                  ) : (
                    <XCircle size={16} className="mx-auto text-red-500" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function SettingsPanel() {
  const [integrations, setIntegrations] = useState<{ google: boolean; smtp: boolean; ai: boolean } | null>(null)

  useEffect(() => {
    api.getAdminStats().then((s) => setIntegrations(s.integrations), () => {})
  }, [])

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Integrations</h2>
        <p className="text-sm text-[#878a8c]">
          Configured via <code className="rounded bg-[#f6f7f8] px-1">backend/.env</code> — restart the API after changes.
        </p>
        <div className="mt-5 space-y-3">
          <IntegrationRow
            label="Google sign-in"
            ok={!!integrations?.google}
            okText="Live — real Google OAuth"
            offText="Demo mode — set GOOGLE_CLIENT_ID to enable"
          />
          <IntegrationRow
            label="Invite emails (SMTP)"
            ok={!!integrations?.smtp}
            okText="Live — real email"
            offText="Simulated — set SMTP_HOST/USER/PASS to send real email"
          />
          <IntegrationRow
            label="AI resume parsing (Claude)"
            ok={!!integrations?.ai}
            okText="Live — Claude parsing"
            offText="Mock result — set ANT_KEY to enable"
          />
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Weekly Digest</h2>
        <p className="mb-4 text-sm text-[#878a8c]">
          Goes out automatically every Monday morning to opted-in members. You can also trigger it now.
        </p>
        <DigestButton />
      </Card>
      <Card className="p-6">
        <h2 className="mb-2 text-base font-bold text-[#1c1c1c]">Invitation Landing Page</h2>
        <p className="mb-4 text-sm text-[#878a8c]">Preview what an invited alumnus sees after clicking their link.</p>
        <Link to="/accept-invite" className="inline-flex items-center gap-2 text-sm font-medium text-[#ff4500] hover:underline">
          Open invitation page <ExternalLink size={15} />
        </Link>
      </Card>
    </div>
  )
}

function IntegrationRow({ label, ok, okText, offText }: { label: string; ok: boolean; okText: string; offText: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#edeff1] px-4 py-3">
      <span className="text-sm font-medium text-[#1c1c1c]">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {ok ? okText : offText}
      </span>
    </div>
  )
}

function DigestButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [result, setResult] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={state === 'sending'}
        onClick={async () => {
          setState('sending')
          try {
            const r = await api.sendDigest()
            setResult(
              r.simulated
                ? `Simulated for ${r.recipients} member(s) — configure SMTP to send real email.`
                : `Sent to ${r.recipients} member(s).`,
            )
            setState('done')
          } catch {
            setResult('Failed — check the server logs.')
            setState('done')
          }
        }}
      >
        {state === 'sending' ? 'Sending…' : 'Send digest now'}
      </Button>
      {result && <span className="text-sm text-[#878a8c]">{result}</span>}
    </div>
  )
}

function ReportsPanel() {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof api.getReports>> | null>(null)
  const load = () => api.getReports().then(setReports, () => setReports([]))
  useEffect(() => {
    load()
  }, [])

  async function act(id: string, action: 'dismiss' | 'resolve' | 'remove') {
    if (action === 'dismiss') await api.dismissReport(id)
    else await api.resolveReport(id, action === 'remove')
    load()
  }

  const open = reports?.filter((r) => r.status === 'open') ?? []
  const handled = reports?.filter((r) => r.status !== 'open') ?? []

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Open Reports ({open.length})</h2>
        <p className="mb-4 text-sm text-[#878a8c]">Content flagged by members, newest first.</p>
        {reports === null ? (
          <p className="text-sm text-[#878a8c]">Loading…</p>
        ) : open.length === 0 ? (
          <p className="text-sm text-[#878a8c]">Nothing to review. 🎉</p>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <div key={r.id} className="rounded-lg border border-[#edeff1] p-4">
                <p className="text-sm text-[#1c1c1c]">{r.summary}</p>
                <p className="mt-1 text-xs text-[#878a8c]">
                  Reported by {r.reporterName}: “{r.reason}”
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.targetType === 'post' && (
                    <Button className="!bg-red-500 !px-3 !py-1.5 text-xs hover:!bg-red-600" onClick={() => act(r.id, 'remove')}>
                      Remove post & resolve
                    </Button>
                  )}
                  <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => act(r.id, 'resolve')}>
                    Resolve (keep content)
                  </Button>
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => act(r.id, 'dismiss')}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {handled.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-bold text-[#1c1c1c]">Recently handled</h2>
          <div className="space-y-2">
            {handled.slice(0, 10).map((r) => (
              <p key={r.id} className="text-sm text-[#878a8c]">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-[#878a8c]'}`}>
                  {r.status}
                </span>
                {r.summary}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
