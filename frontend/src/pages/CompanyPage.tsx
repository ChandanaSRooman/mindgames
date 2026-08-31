import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Bookmark, Briefcase, Handshake, MapPin, Sparkles, UserPlus, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { Avatar, Button, Card, CompanyLogo } from '../components/ui'
import { ReachOutModal } from '../components/referral/ReachOutModal'
import { ConnectNoteModal } from '../components/referral/ConnectNoteModal'
import type { CompanyAlumnus, CompanyDetail } from '../types'

export function CompanyPage() {
  const { id } = useParams<{ id: string }>()
  const { notify } = useApp()
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reachOutFor, setReachOutFor] = useState<CompanyAlumnus | null>(null)
  const [connectFor, setConnectFor] = useState<CompanyAlumnus | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .getCompany(id)
      .then(setCompany)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  function toggleSave() {
    if (!company) return
    const saved = company.savedByMe
    setCompany({ ...company, savedByMe: !saved })
    const call = saved ? api.unsaveCompany(company.id) : api.saveCompany(company.id)
    call.catch(() => setCompany((c) => (c ? { ...c, savedByMe: saved } : c)))
  }

  if (notFound) return <Navigate to="/companies" replace />
  if (loading || !company) {
    return <p className="text-sm text-[#878a8c]">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={64} />
            <div>
              <h1 className="text-xl font-bold text-[#1c1c1c]">{company.name}</h1>
              <p className="flex items-center gap-1 text-sm text-[#878a8c]">
                <Users size={14} /> {company.industry} · {company.alumniCount} Rooman alumni here
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={company.savedByMe ? 'subtle' : 'outline'}
              icon={<Bookmark size={15} className={company.savedByMe ? 'fill-[#ff4500] text-[#ff4500]' : ''} />}
              onClick={toggleSave}
            >
              {company.savedByMe ? 'Saved' : 'Save'}
            </Button>
            <Button
              variant="outline"
              icon={<Sparkles size={15} />}
              onClick={() => notify('Hire AI integration is coming soon.')}
            >
              Take a test on Hire AI
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold text-[#1c1c1c]">Rooman alumni at {company.name}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {company.alumni.map((a) => (
            <AlumnusCard
              key={a.id}
              alum={a}
              onConnect={() => setConnectFor(a)}
              onReachOut={() => setReachOutFor(a)}
            />
          ))}
          {company.alumni.length === 0 && (
            <div className="col-span-full rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
              No Rooman alumni here yet.
            </div>
          )}
        </div>
      </div>

      {reachOutFor && (
        <ReachOutModal
          user={{ id: reachOutFor.id, name: reachOutFor.name, company: company.name }}
          extended
          onClose={() => setReachOutFor(null)}
        />
      )}
      {connectFor && (
        <ConnectNoteModal
          user={{ id: connectFor.id, name: connectFor.name }}
          onClose={() => setConnectFor(null)}
        />
      )}
    </div>
  )
}

function AlumnusCard({
  alum,
  onConnect,
  onReachOut,
}: {
  alum: CompanyAlumnus
  onConnect: () => void
  onReachOut: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={alum.name} src={alum.photo} size={44} to={`/profile/${alum.id}`} />
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${alum.id}`} className="font-bold text-[#1c1c1c] hover:underline">
            {alum.name}
          </Link>
          {alum.role && (
            <p className="flex items-center gap-1 text-xs text-[#878a8c]">
              <Briefcase size={11} /> {alum.role}
            </p>
          )}
          {alum.location && (
            <p className="flex items-center gap-1 text-xs text-[#878a8c]">
              <MapPin size={11} /> {alum.location}
            </p>
          )}
          {alum.journey && (
            <p className="mt-1.5 line-clamp-2 text-xs text-[#6b6e70]">{alum.journey}</p>
          )}
          {alum.mutualConnections > 0 && (
            <p className="mt-1.5 text-xs font-semibold text-[#ff4500]">
              {alum.mutualConnections} mutual connection{alum.mutualConnections > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="subtle" className="flex-1 !px-3 !py-1.5 text-xs" icon={<UserPlus size={13} />} onClick={onConnect}>
          Connect
        </Button>
        <Button variant="primary" className="flex-1 !px-3 !py-1.5 text-xs" icon={<Handshake size={13} />} onClick={onReachOut}>
          Reach Out
        </Button>
      </div>
    </Card>
  )
}
