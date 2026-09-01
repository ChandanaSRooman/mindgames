import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, BookOpen, Building2, Search, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { matchesCompanyQuery } from '../lib/search'
import { AvatarStack, Button, Card, CompanyLogo, Pill } from '../components/ui'
import type { Company } from '../types'

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('All')
  const [savedOnly, setSavedOnly] = useState(false)

  useEffect(() => {
    api.getCompanies().then(setCompanies).finally(() => setLoading(false))
  }, [])

  const industries = useMemo(
    () => ['All', ...Array.from(new Set(companies.map((c) => c.industry))).sort()],
    [companies],
  )

  const filtered = useMemo(
    () =>
      companies
        .filter((c) => matchesCompanyQuery(c, search))
        .filter((c) => industry === 'All' || c.industry === industry)
        .filter((c) => !savedOnly || c.savedByMe),
    [companies, search, industry, savedOnly],
  )

  function toggleSave(id: string, saved: boolean) {
    setCompanies((list) => list.map((c) => (c.id === id ? { ...c, savedByMe: !saved } : c)))
    const call = saved ? api.unsaveCompany(id) : api.saveCompany(id)
    call.catch(() => setCompanies((list) => list.map((c) => (c.id === id ? { ...c, savedByMe: saved } : c))))
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1c1c1c]">
          <Building2 size={24} className="text-[#ff4500]" /> Companies
        </h1>
        <p className="mt-1 text-sm text-[#878a8c]">
          Find your dream company, see the Rooman alumni already there, and reach out.
        </p>
      </div>

      {/* Search hero */}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#878a8c]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your dream company…"
          className="w-full rounded-full border border-[#edeff1] bg-white py-3.5 pr-4 pl-11 text-sm text-[#1c1c1c] shadow-sm outline-none focus:border-[#ff4500] focus:ring-2 focus:ring-[#ff4500]/20"
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          icon={<Sparkles size={15} />}
          onClick={() => window.open('https://hiresolution.ai/career-profiler', '_blank')}
        >
          Take a test on Hire AI
        </Button>
        <Button
          variant="outline"
          icon={<BookOpen size={15} />}
          onClick={() => window.open('https://lms.rooman.com/', '_blank')}
        >
          Prepare using our Rooman LMS
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {industries.map((ind) => (
          <Pill key={ind} active={industry === ind} onClick={() => setIndustry(ind)}>{ind}</Pill>
        ))}
        <Pill active={savedOnly} onClick={() => setSavedOnly((v) => !v)}>
          <span className="flex items-center gap-1"><Bookmark size={13} /> Saved</span>
        </Pill>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-[#878a8c]">Loading companies…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CompanyCard key={c.id} company={c} onToggleSave={() => toggleSave(c.id, c.savedByMe)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
              No companies match your search.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CompanyCard({ company, onToggleSave }: { company: Company; onToggleSave: () => void }) {
  return (
    <Card className="relative p-4">
      <button
        onClick={(e) => {
          e.preventDefault()
          onToggleSave()
        }}
        title={company.savedByMe ? 'Remove from saved' : 'Save company'}
        className="absolute top-3 right-3 rounded-full p-1.5 text-[#878a8c] transition-colors hover:bg-gray-100"
      >
        <Bookmark size={16} className={company.savedByMe ? 'fill-[#ff4500] text-[#ff4500]' : ''} />
      </button>
      <Link to={`/companies/${company.id}`} className="flex flex-col gap-3">
        <div className="flex items-center gap-3 pr-6">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
          <div className="min-w-0">
            <p className="truncate font-bold text-[#1c1c1c]">{company.name}</p>
            <span className="rounded-full bg-[#f6f7f8] px-2 py-0.5 text-xs font-medium text-[#878a8c]">{company.industry}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {company.previewAlumni.length > 0 ? (
            <>
              <AvatarStack people={company.previewAlumni} total={company.alumniCount} size={26} />
              <span className="text-xs font-medium text-[#1c1c1c]">
                {company.alumniCount} Rooman alumni here
              </span>
            </>
          ) : (
            <span className="text-xs text-[#878a8c]">No Rooman alumni here yet</span>
          )}
        </div>
      </Link>
    </Card>
  )
}
