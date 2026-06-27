import { useMemo, useState } from 'react'
import { Mail, MessageCircle, Send } from 'lucide-react'
import type { Alumni } from '../../types'
import { api } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import { Button, Card, Checkbox, StatusBadge, cx } from '../ui'

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
        <Button onClick={send} loading={sending} disabled={!someOn} icon={<Send size={16} />}>
          Send Batch Invitations
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
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
                <td colSpan={7} className="px-4 py-10 text-center text-[#878a8c]">
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
    </Card>
  )
}
