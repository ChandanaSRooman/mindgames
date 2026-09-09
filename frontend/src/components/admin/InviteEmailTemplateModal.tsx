import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Mail, RotateCcw, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import type { InviteEmailTemplate } from '../../types'
import { Button } from '../ui'

// Edits the credentials email an invited member receives. Sending an invite
// creates their account and mails them a generated password, so this copy is
// the only place those credentials are ever shown — which is why {{password}}
// and {{link}} can't be removed (the backend rejects a body without them).
//
// A saved template is an override; "Reset to default" deletes it rather than
// writing the default text back, so the built-in copy stays the source of
// truth and can be improved in code later without stranding anyone.

/** Substitutes {{name}}-style tokens — mirrors renderTemplate on the backend. */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole,
  )
}

export function InviteEmailTemplateModal({ onClose }: { onClose: () => void }) {
  const { notify } = useApp()
  const [tpl, setTpl] = useState<InviteEmailTemplate | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api
      .getInviteEmailTemplate()
      .then((t) => {
        setTpl(t)
        setSubject(t.subject)
        setBody(t.body)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the template.'))
      .finally(() => setLoading(false))
  }, [])

  const dirty = !!tpl && (subject !== tpl.subject || body !== tpl.body)

  const preview = useMemo(() => {
    if (!tpl) return { subject: '', body: '' }
    return { subject: render(subject, tpl.sample), body: render(body, tpl.sample) }
  }, [subject, body, tpl])

  // Which required tokens the current draft has dropped — surfaced live so the
  // admin sees it while typing rather than only when Save is refused.
  const missing = useMemo(
    () => (tpl ? tpl.required.filter((name) => !body.includes(`{{${name}}}`)) : []),
    [body, tpl],
  )

  /** Drops a token in at the cursor, so the legend is usable, not just documentation. */
  function insert(token: string) {
    const el = bodyRef.current
    const text = `{{${token}}}`
    if (!el) return setBody((b) => b + text)
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    setBody(body.slice(0, start) + text + body.slice(end))
    // Restore focus and drop the caret after what we just inserted.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + text.length, start + text.length)
    })
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      await api.saveInviteEmailTemplate(subject, body)
      notify('Invite email template saved — the next batch will use it.')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the template.')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    setError(null)
    setSaving(true)
    try {
      const d = await api.resetInviteEmailTemplate()
      setSubject(d.subject)
      setBody(d.body)
      setTpl((t) => (t ? { ...t, subject: d.subject, body: d.body, isCustom: false, updatedAt: null } : t))
      notify('Reverted to the default invite email.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset the template.')
    } finally {
      setSaving(false)
    }
  }

  const field =
    'w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-[#edeff1] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
              <Mail size={18} className="text-[#ff4500]" /> Invite Email Template
            </h2>
            <p className="mt-0.5 text-xs text-[#878a8c]">
              {tpl?.isCustom ? 'Customised' : 'Using the built-in default'}
              {tpl?.updatedAt ? ` · edited ${new Date(tpl.updatedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#878a8c] transition-colors hover:bg-gray-100 hover:text-[#1c1c1c]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-[#878a8c]">Loading…</p>
          ) : (
            <>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#878a8c]">
                Subject
              </label>
              <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />

              <div className="mt-4 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#878a8c]">
                  Body
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff4500] hover:underline"
                >
                  <Eye size={13} /> {showPreview ? 'Hide preview' : 'Show preview'}
                </button>
              </div>

              {showPreview ? (
                <div className="mt-1 rounded-lg border border-[#edeff1] bg-[#f6f7f8] p-4">
                  <p className="mb-2 text-xs text-[#878a8c]">
                    Preview with sample values — this is what a recipient sees.
                  </p>
                  <p className="mb-3 text-sm font-semibold text-[#1c1c1c]">{preview.subject}</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm text-[#1c1c1c]">
                    {preview.body}
                  </pre>
                </div>
              ) : (
                <textarea
                  ref={bodyRef}
                  className={`${field} mt-1 min-h-[260px] font-mono text-xs leading-relaxed`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck={false}
                />
              )}

              {/* placeholder legend — click to insert at the cursor */}
              <div className="mt-3">
                <p className="mb-1.5 text-xs text-[#878a8c]">
                  Click to insert. These are filled in per recipient when the invite is sent.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tpl?.placeholders.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => insert(name)}
                      disabled={showPreview}
                      title={tpl.required.includes(name) ? 'Required' : 'Optional'}
                      className="rounded-full border border-[#edeff1] bg-[#f6f7f8] px-2.5 py-1 font-mono text-xs text-[#1c1c1c] transition-colors hover:border-[#ff4500] hover:text-[#ff4500] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {`{{${name}}}`}
                      {tpl.required.includes(name) && <span className="ml-1 text-[#ff4500]">*</span>}
                    </button>
                  ))}
                </div>
              </div>

              {missing.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  Add {missing.map((m) => `{{${m}}}`).join(' and ')} back to the body — without it the
                  invited member has no way to sign in, so this can't be saved.
                </p>
              )}

              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edeff1] px-5 py-4">
          <Button
            variant="ghost"
            icon={<RotateCcw size={15} />}
            onClick={reset}
            disabled={loading || saving || !tpl?.isCustom}
            title={tpl?.isCustom ? 'Revert to the built-in copy' : 'Already using the default'}
          >
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} disabled={loading || !dirty || missing.length > 0}>
              Save template
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
