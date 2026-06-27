import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, ExternalLink, Megaphone, Pin, X, XCircle } from 'lucide-react'
import type { Alumni, ContactRow } from '../types'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { AdminLayout, type AdminView } from '../components/admin/AdminLayout'
import { StatBar } from '../components/admin/StatBar'
import { CsvUpload } from '../components/admin/CsvUpload'
import { AddUserForm } from '../components/admin/AddUserForm'
import { AlumniTable } from '../components/admin/AlumniTable'
import { Avatar, Button, Card } from '../components/ui'
import { timeAgo } from '../lib/format'

// NOTE: Restyled to the light RooConnect theme. All api.* invite/alumni LOGIC
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

      {view === 'settings' && <SettingsPanel />}
    </AdminLayout>
  )
}

// Pin announcements to the alumni feed (wired to the app's mock feed/notifications).
function AnnouncementsPanel() {
  const { announce, posts, userById } = useApp()
  const [text, setText] = useState('')
  const pinned = posts.filter((p) => p.pinned)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
          <Megaphone size={18} className="text-[#ff4500]" /> Pin an Announcement
        </h2>
        <p className="mb-4 mt-1 text-sm text-[#878a8c]">
          Posts to the top of every alumnus's feed and sends an announcement notification.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. Alumni Summit 2026 registrations are now open!"
          className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        />
        <Button className="mt-3" icon={<Pin size={15} />} disabled={!text.trim()} onClick={() => { announce(text); setText('') }}>
          Pin to Feed
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-bold text-[#1c1c1c]">Live Pinned Announcements</h2>
        <div className="mt-3 flex flex-col gap-3">
          {pinned.map((p) => (
            <div key={p.id} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
              <p className="text-sm text-[#1c1c1c]">{p.content}</p>
              <p className="mt-1 text-xs text-[#878a8c]">{userById(p.authorId)?.name} · {timeAgo(p.createdAt)}</p>
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
  const { pendingMentorIds, userById, approveMentor, declineMentor, users } = useApp()
  const pending = pendingMentorIds.map(userById).filter(Boolean) as NonNullable<ReturnType<typeof userById>>[]
  const activeMentors = users.filter((u) => u.isMentor && u.id !== 'me' && u.id !== 'rooman')

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
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 text-base font-bold text-[#1c1c1c]">Network Settings</h2>
        <p className="text-sm text-[#878a8c]">Configuration placeholders — wired for demo purposes.</p>
        <div className="mt-5 space-y-4">
          {['Allow public profile discovery', 'Auto-approve incubation applicants', 'Send weekly digest emails'].map(
            (label, i) => (
              <label key={label} className="flex items-center justify-between rounded-lg border border-[#edeff1] bg-[#f6f7f8] px-4 py-3">
                <span className="text-sm text-[#1c1c1c]">{label}</span>
                <input type="checkbox" defaultChecked={i === 0} className="h-5 w-5 cursor-pointer rounded accent-[#ff4500]" />
              </label>
            ),
          )}
        </div>
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
