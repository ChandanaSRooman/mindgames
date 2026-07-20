import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ExternalLink, FlaskConical, Globe, Lock, Rocket, Users2, Wallet } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Avatar, Button, Card, SectionTitle } from '../components/ui'
import { DOMAINS, type Domain, type StartupStage } from '../types'

// Rooman's incubation program — the official site this page links out to.
const STARTUPVARSITY_URL = 'https://www.startupvarsity.com'

const STAGES: StartupStage[] = ['Idea', 'MVP', 'Early Revenue', 'Scaling']

const STAGE_STYLES: Record<StartupStage, string> = {
  Idea: 'bg-gray-100 text-gray-600',
  MVP: 'bg-blue-100 text-blue-700',
  'Early Revenue': 'bg-green-100 text-green-700',
  Scaling: 'bg-purple-100 text-purple-700',
}

export function StartupVarsity() {
  const { startups, userById, submitStartup } = useApp()
  const [form, setForm] = useState({ name: '', domain: '' as Domain | '', stage: '' as StartupStage | '', teamSize: '', description: '' })
  const [visibility, setVisibility] = useState<'network' | 'admin'>('network')
  const [shareToFeed, setShareToFeed] = useState(true)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const canSubmit = form.name && form.domain && form.stage && form.description

  function submit() {
    if (!canSubmit) return
    submitStartup(
      {
        name: form.name,
        domain: form.domain as Domain,
        stage: form.stage as StartupStage,
        teamSize: Number(form.teamSize) || 1,
        description: form.description,
        visibility,
      },
      // A confidential application is never shared to the feed.
      visibility === 'network' && shareToFeed,
    )
    setForm({ name: '', domain: '', stage: '', teamSize: '', description: '' })
    setVisibility('network')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Explainer */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-[#7c3aed] to-[#ff4500] px-6 py-7 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Rocket size={26} />
              <h1 className="text-2xl font-bold">StartupVarsity</h1>
            </div>
            <a
              href={STARTUPVARSITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-[#7c3aed] shadow-sm transition-colors hover:bg-white"
            >
              Visit startupvarsity.com <ExternalLink size={15} />
            </a>
          </div>
          <p className="mt-2 max-w-xl text-violet-50">
            Turn your idea into a company. Build your product using Rooman's labs, mentor network and
            seed support — built for alumni founders.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Resource icon={<FlaskConical size={20} />} title="Lab Space" body="Hardware & software labs at Rooman centers." />
          <Resource icon={<Users2 size={20} />} title="Mentors" body="Guidance from successful founder alumni." />
          <Resource icon={<Wallet size={20} />} title="Seed Support" body="Early funding & go-to-market help." />
        </div>
      </Card>

      {/* Apply form */}
      <Card className="p-5">
        <SectionTitle>Apply to Build Your Startup</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Startup name" className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]" />
          <input value={form.teamSize} onChange={(e) => set('teamSize', e.target.value.replace(/\D/g, ''))} placeholder="Team size" className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]" />
          <select value={form.domain} onChange={(e) => set('domain', e.target.value)} className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm text-[#1c1c1c] outline-none focus:border-[#ff4500]">
            <option value="">Domain</option>
            {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={form.stage} onChange={(e) => set('stage', e.target.value)} className="rounded-lg border border-[#edeff1] px-3 py-2 text-sm text-[#1c1c1c] outline-none focus:border-[#ff4500]">
            <option value="">Stage</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Describe your idea…" className="mt-3 w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]" />
        {/* Who can see the idea */}
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-[#1c1c1c]">Who can see this idea?</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setVisibility('network')}
              className={`flex flex-1 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                visibility === 'network'
                  ? 'border-[#ff4500] bg-orange-50'
                  : 'border-[#edeff1] hover:bg-gray-50'
              }`}
            >
              <Globe size={18} className={visibility === 'network' ? 'mt-0.5 text-[#ff4500]' : 'mt-0.5 text-[#878a8c]'} />
              <span>
                <span className="block text-sm font-semibold text-[#1c1c1c]">Everyone in the network</span>
                <span className="block text-xs text-[#878a8c]">
                  Listed under "Startups from the Network" for all alumni.
                </span>
              </span>
            </button>
            <button
              onClick={() => setVisibility('admin')}
              className={`flex flex-1 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                visibility === 'admin'
                  ? 'border-[#ff4500] bg-orange-50'
                  : 'border-[#edeff1] hover:bg-gray-50'
              }`}
            >
              <Lock size={18} className={visibility === 'admin' ? 'mt-0.5 text-[#ff4500]' : 'mt-0.5 text-[#878a8c]'} />
              <span>
                <span className="block text-sm font-semibold text-[#1c1c1c]">Only Rooman admins</span>
                <span className="block text-xs text-[#878a8c]">
                  Confidential — reviewed by the StartupVarsity team; hidden from other alumni.
                </span>
              </span>
            </button>
          </div>
        </div>

        {visibility === 'network' ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-[#1c1c1c]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#ff4500]"
              checked={shareToFeed}
              onChange={(e) => setShareToFeed(e.target.checked)}
            />
            Also share my idea as a post so the network can see it
          </label>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[#878a8c]">
            <Lock size={13} /> Your idea stays between you and the Rooman admins. It won't appear
            in the startup list or the feed.
          </p>
        )}
        <Button className="mt-3" disabled={!canSubmit} onClick={submit}>Submit Application</Button>
      </Card>

      {/* Listed startups */}
      <section>
        <SectionTitle>Startups from the Network</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {startups.map((s) => {
            const founder = userById(s.founderId)
            return (
              <Card key={s.id} className="p-5">
                {s.visibility === 'admin' && (
                  <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-[#f6f7f8] px-2.5 py-1.5 text-xs font-medium text-[#878a8c]">
                    <Lock size={12} /> Private — only you and Rooman admins can see this.
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                      <Building2 size={20} />
                    </span>
                    <div>
                      <p className="font-bold text-[#1c1c1c]">{s.name}</p>
                      <p className="text-xs text-[#878a8c]">{s.domain}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLES[s.stage]}`}>{s.stage}</span>
                </div>
                <p className="mt-3 text-sm text-[#1c1c1c]">{s.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[#edeff1] pt-3">
                  <Link to={`/profile/${founder?.id}`} className="flex items-center gap-2 text-sm hover:underline">
                    <Avatar name={founder?.name ?? '?'} src={founder?.photo} size={28} />
                    <span className="text-[#878a8c]">{founder?.name}</span>
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-[#878a8c]"><Users2 size={14} /> {s.teamSize} members</span>
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// Each resource card opens the official StartupVarsity site in a new tab.
function Resource({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <a
      href={STARTUPVARSITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl border border-[#edeff1] p-4 transition-colors hover:border-[#7c3aed] hover:bg-purple-50/40"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">{icon}</span>
      <p className="mt-2 flex items-center gap-1 font-semibold text-[#1c1c1c]">
        {title}
        <ExternalLink size={12} className="text-[#878a8c] opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
      <p className="text-xs text-[#878a8c]">{body}</p>
    </a>
  )
}
