import { useMemo, useState } from 'react'
import { FilePenLine, Mail, MessageCircle, Send } from 'lucide-react'
import type { Alumni } from '../../types'
import { api } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import { Button, Card, Checkbox, StatusBadge, cx } from '../ui'
import { InviteEmailTemplateModal } from './InviteEmailTemplateModal'

type Channel = { email: boolean; whatsapp: boolean }

export function AlumniTable({
  alumni,
  onInvitesSent,
}: {
  alumni: Alumni[]
  onInvitesSent: (count: number) => void
}) {
  const { notify } = useApp()
  const [selection, setSelection] = useState<Record<string, Channel>>({})
  const [sending, setSending] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(false)

  const get = (id: string): Channel => selection[id] ?? { email: false, whatsapp: false }

  const counts = useMemo(() => {
    let email = 0
    let whatsapp = 0
    for (const a of alumni) {
      const c = get(a.id)
      if (c.email) email++
      if (c.whatsapp) whatsapp++
    }
    return { email, whatsapp, total: email + whatsapp }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, alumni])

  const allOn = alumni.length > 0 && alumni.every((a) => get(a.id).email && get(a.id).whatsapp)
  const someOn = counts.total > 0

  function toggleAll(on: boolean) {
    const next: Record<string, Channel> = {}
    if (on) for (const a of alumni) next[a.id] = { email: true, whatsapp: true }
    setSelection(next)
  }

  function toggleCell(id: string, channel: keyof Channel, on: boolean) {
    setSelection((s) => ({ ...s, [id]: { ...get(id), [channel]: on } }))
  }

  async function send() {
    const invites = alumni
      .map((a) => ({ id: a.id, ...get(a.id) }))
      .filter((i) => i.email || i.whatsapp)
    if (invites.length === 0) return
    setSending(true)
    try {
      const res = await api.sendInvites(invites)
      notify(res.message, 'success')
      onInvitesSent(res.total)
      setSelection({})
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to send invitations', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edeff1] px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-[#1c1c1c]">Multi-Channel Invitations</h3>
          <p className="text-xs text-[#878a8c]">
            {someOn ? `${counts.email} email · ${counts.whatsapp} WhatsApp selected` : 'Select recipients and channels'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            icon={<FilePenLine size={15} />}
            onClick={() => setEditingTemplate(true)}
          >
            Edit email
          </Button>
          <Button onClick={send} loading={sending} disabled={!someOn} icon={<Send size={16} />}>
            Send Batch Invitations
          </Button>
        </div>
      </div>

      {/* Emailing an invitee creates their account, so say so before the click
          rather than leaving it to be discovered from the result toast. */}
      <p className="border-b border-[#edeff1] bg-orange-50/60 px-4 py-2.5 text-xs text-[#1c1c1c]">
        <span className="font-semibold">Sending an email invitation creates the account.</span>{' '}
        Each recipient gets a generated password and a sign-in link, and can change that password
        once inside. Anyone who already has an account is skipped. WhatsApp is simulated and
        creates nothing.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#edeff1] text-xs uppercase tracking-wide text-[#878a8c]">
              <th className="w-10 px-4 py-3">
                <Checkbox
                  aria-label="Select all recipients and channels"
                  checked={allOn}
                  indeterminate={someOn && !allOn}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Invite</th>
              <th className="px-4 py-3 text-center font-medium">
                <span className="inline-flex items-center gap-1"><Mail size={14} /> Email</span>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <span className="inline-flex items-center gap-1"><MessageCircle size={14} /> WhatsApp</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {alumni.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[#878a8c]">
                  No alumni yet. Upload a CSV or add one manually to get started.
                </td>
              </tr>
            ) : (
              alumni.map((a) => {
                const c = get(a.id)
                return (
                  <tr
                    key={a.id}
                    className={cx('border-b border-[#edeff1] transition-colors hover:bg-gray-50', (c.email || c.whatsapp) && 'bg-orange-50/60')}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        aria-label={`Select ${a.name}`}
                        checked={c.email && c.whatsapp}
                        indeterminate={c.email !== c.whatsapp}
                        onChange={(on) => setSelection((s) => ({ ...s, [a.id]: { email: on, whatsapp: on } }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1c1c1c]">{a.name}</p>
                      <p className="text-xs text-[#878a8c]">{a.role}</p>
                    </td>
                    <td className="px-4 py-3 text-[#878a8c]">{a.phone || '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#878a8c]">{a.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.statusTags.length ? (
                          a.statusTags.map((t) => <StatusBadge key={t} tag={t} />)
                        ) : (
                          <span className="text-xs text-[#878a8c]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.inviteStatus === 'failed' ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Failed
                        </span>
                      ) : a.inviteStatus ? (
                        <span
                          className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                          title={a.invitedAt ? new Date(a.invitedAt).toLocaleString() : undefined}
                        >
                          {a.inviteStatus === 'simulated' ? 'Simulated' : 'Sent'}
                        </span>
                      ) : (
                        <span className="text-xs text-[#878a8c]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox aria-label={`Email ${a.name}`} checked={c.email} onChange={(on) => toggleCell(a.id, 'email', on)} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox aria-label={`WhatsApp ${a.name}`} checked={c.whatsapp} onChange={(on) => toggleCell(a.id, 'whatsapp', on)} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editingTemplate && <InviteEmailTemplateModal onClose={() => setEditingTemplate(false)} />}
    </Card>
  )
}
