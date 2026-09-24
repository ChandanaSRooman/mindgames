import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Card } from '../ui'
import { api, type ServiceInput } from '../../lib/api'
import { useApp } from '../../store/AppStore'
import { SERVICE_ICONS, serviceName, servicePrice } from '../../lib/careerServices'
import { SERVICE_CATEGORIES, SERVICE_LABELS, type AlumniService, type ServiceType } from '../../types'

const BLANK: ServiceInput = {
  serviceType: 'career_guidance',
  title: '',
  description: '',
  tags: [],
  pricingMode: 'free',
  pricingUnit: 'session',
}

/** Mentor-side panel: list, add and activate/deactivate the services this
 *  member offers. Only reachable by approved mentors — the same verification
 *  bar the rest of mentorship already uses. */
export function ManageServicesPanel({ onClose }: { onClose: () => void }) {
  const { notify } = useApp()
  const [mine, setMine] = useState<AlumniService[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ServiceInput>(BLANK)
  const [tagText, setTagText] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // This panel opens below the button that spawned it, and in Mentor Space
  // that button sits near the bottom of a long page — so the panel appeared
  // off-screen and pressing "Manage services" looked like it did nothing at
  // all. Bring it into view instead of leaving the member to guess.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  useEffect(() => {
    api
      .getMyServices()
      .then(setMine)
      .catch(() => notify('Could not load your services.', 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  async function create() {
    setSaving(true)
    try {
      const created = await api.createService({
        ...form,
        tags: tagText.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setMine((list) => [created, ...list])
      setForm(BLANK)
      setTagText('')
      notify('Service added.', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not add the service.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: AlumniService) {
    try {
      const updated = await api.updateService(s.id, { active: !s.active })
      setMine((list) => list.map((x) => (x.id === updated.id ? updated : x)))
    } catch {
      notify('Could not update the service.', 'error')
    }
  }

  return (
    <Card ref={panelRef} className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1c1c1c]">Services you offer</h2>
          <p className="text-sm text-[#878a8c]">
            Listed to members whose roadmap matches what you provide. Pricing is shown to them —
            payment is arranged with you directly.
          </p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-[#878a8c] hover:bg-gray-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-sm text-[#878a8c]">Loading…</p>
      ) : (
        <div className="mb-5 flex flex-col gap-2">
          {mine.length === 0 && (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-sm text-[#878a8c]">
              You haven’t listed any services yet.
            </p>
          )}
          {mine.map((s) => {
            const { icon: Icon, classes } = SERVICE_ICONS[s.serviceType] ?? SERVICE_ICONS.career_guidance
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-[#edeff1] px-3 py-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${classes}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1c1c1c]">{serviceName(s)}</p>
                  <p className="truncate text-xs text-[#878a8c]">
                    {servicePrice(s)}
                    {s.tags.length > 0 && ` · ${s.tags.join(', ')}`}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(s)}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-[#878a8c]'
                  }`}
                >
                  {s.active ? 'Active' : 'Paused'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-[#edeff1] pt-4">
        <h3 className="mb-3 text-sm font-bold text-[#1c1c1c]">Add a service</h3>

        <label className="mb-1 block text-xs font-semibold text-[#878a8c]">Type</label>
        <select
          value={form.serviceType}
          onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })}
          className="mb-3 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        >
          {SERVICE_CATEGORIES.map((cat) => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.types.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_LABELS[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <label className="mb-1 block text-xs font-semibold text-[#878a8c]">Title (optional)</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={SERVICE_LABELS[form.serviceType]}
          className="mb-3 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        />

        <label className="mb-1 block text-xs font-semibold text-[#878a8c]">What you provide</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="mb-3 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        />

        <label className="mb-1 block text-xs font-semibold text-[#878a8c]">
          Skills / domains it covers (comma separated)
        </label>
        <input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          placeholder="python, llm, rag"
          className="mb-3 w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
        />

        <label className="mb-1 block text-xs font-semibold text-[#878a8c]">Pricing</label>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['free', 'paid', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setForm({ ...form, pricingMode: mode })}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize ${
                form.pricingMode === mode
                  ? 'border-[#ff4500] bg-orange-50 text-[#ff4500]'
                  : 'border-[#edeff1] text-[#1c1c1c] hover:bg-gray-50'
              }`}
            >
              {mode === 'custom' ? 'On request' : mode}
            </button>
          ))}
          {form.pricingMode === 'paid' && (
            <>
              <span className="text-sm text-[#878a8c]">₹</span>
              <input
                type="number"
                min={0}
                value={form.amount ?? ''}
                onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="w-24 rounded-lg border border-[#edeff1] px-3 py-1.5 text-sm outline-none focus:border-[#ff4500]"
              />
              <select
                value={form.pricingUnit ?? 'session'}
                onChange={(e) => setForm({ ...form, pricingUnit: e.target.value as 'hour' | 'session' })}
                className="rounded-lg border border-[#edeff1] px-2 py-1.5 text-sm outline-none focus:border-[#ff4500]"
              >
                <option value="hour">per hour</option>
                <option value="session">per session</option>
              </select>
            </>
          )}
        </div>

        <Button
          icon={<Plus size={14} />}
          loading={saving}
          disabled={form.pricingMode === 'paid' && form.amount === undefined}
          onClick={create}
        >
          Add service
        </Button>
      </div>
    </Card>
  )
}
