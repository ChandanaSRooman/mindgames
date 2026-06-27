import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import type { Alumni, ContactRow } from '../types'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { AdminLayout, type AdminView } from '../components/admin/AdminLayout'
import { StatBar } from '../components/admin/StatBar'
import { CsvUpload } from '../components/admin/CsvUpload'
import { AddUserForm } from '../components/admin/AddUserForm'
import { AlumniTable } from '../components/admin/AlumniTable'
import { Card } from '../components/ui'

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
            <Card className="lg:col-span-2 p-5">
              <h2 className="mb-1 text-base font-semibold text-white">Bulk Upload (CSV)</h2>
              <p className="mb-4 text-sm text-slate-400">Import a contact list — we keep only Name, Phone and Email.</p>
              <CsvUpload onParsed={setPreview} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-1 text-base font-semibold text-white">Add Individually</h2>
              <p className="mb-4 text-sm text-slate-400">Quick single-user entry.</p>
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

      {view === 'settings' && <SettingsPanel />}
    </AdminLayout>
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">
          Parsed Preview — <span className="text-teal-300">{validCount} valid</span>
          {rows.length - validCount > 0 && <span className="text-rose-300"> · {rows.length - validCount} flagged</span>}
        </h3>
        <div className="flex gap-2">
          <button onClick={onDiscard} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-navy-800">
            Discard
          </button>
          <button onClick={onImport} className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-navy-950 hover:bg-teal-400">
            Import {validCount}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700/60 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 text-center font-medium">Valid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-navy-800/60">
                <td className="px-4 py-2 text-slate-200">{r.name || <span className="text-rose-300">missing</span>}</td>
                <td className="px-4 py-2 text-slate-300">{r.phone || '—'}</td>
                <td className="px-4 py-2 text-slate-300">{r.email || <span className="text-rose-300">missing</span>}</td>
                <td className="px-4 py-2 text-center">
                  {r.valid ? (
                    <CheckCircle2 size={16} className="mx-auto text-teal-400" />
                  ) : (
                    <XCircle size={16} className="mx-auto text-rose-400" />
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
        <h2 className="mb-1 text-base font-semibold text-white">Network Settings</h2>
        <p className="text-sm text-slate-400">Configuration placeholders — wired for demo purposes.</p>
        <div className="mt-5 space-y-4">
          {['Allow public profile discovery', 'Auto-approve incubation applicants', 'Send weekly digest emails'].map(
            (label, i) => (
              <label key={label} className="flex items-center justify-between rounded-lg border border-navy-700/60 bg-navy-800/40 px-4 py-3">
                <span className="text-sm text-slate-200">{label}</span>
                <input type="checkbox" defaultChecked={i === 0} className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-navy-600 accent-teal-500 checked:bg-teal-500" />
              </label>
            ),
          )}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-2 text-base font-semibold text-white">Invitation Landing Page</h2>
        <p className="mb-4 text-sm text-slate-400">Preview what an invited alumnus sees after clicking their link.</p>
        <Link to="/accept-invite" className="inline-flex items-center gap-2 text-sm font-medium text-teal-300 hover:text-teal-200">
          Open invitation page <ExternalLink size={15} />
        </Link>
      </Card>
    </div>
  )
}
