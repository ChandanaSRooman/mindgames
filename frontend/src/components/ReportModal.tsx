import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { Button } from './ui'

/** Flag a post or member for the admin team. */
export function ReportModal({
  targetType,
  targetId,
  targetLabel,
  onClose,
}: {
  targetType: 'post' | 'user'
  targetId: string
  targetLabel: string
  onClose: () => void
}) {
  const { notify } = useApp()
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    if (reason.trim().length < 3) return
    setSending(true)
    try {
      const r = await api.report(targetType, targetId, reason.trim())
      notify(
        r.already
          ? 'You already reported this — the admin team is on it.'
          : 'Report sent. The admin team will review it.',
        'info',
      )
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send the report.', 'error')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="animate-slidein w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div className="flex items-center gap-2">
            <Flag size={17} className="text-red-500" />
            <h2 className="font-bold text-[#1c1c1c]">Report {targetType}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#878a8c] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[#878a8c]">
            Reporting <span className="font-semibold text-[#1c1c1c]">{targetLabel}</span>. Only the
            Rooman admin team sees this.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="What's wrong? (spam, harassment, fake job, impersonation…)"
            className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#edeff1] px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={reason.trim().length < 3 || sending} onClick={submit}>
            {sending ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </div>
    </div>
  )
}
