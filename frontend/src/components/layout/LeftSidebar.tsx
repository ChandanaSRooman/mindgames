import { NavLink, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Calendar,
  Compass,
  GraduationCap,
  Home,
  Newspaper,
  Plus,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'

const NAV = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/network', label: 'My Network', icon: Users },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/jobs', label: 'Jobs & Opportunities', icon: Briefcase },
  { to: '/mentorship', label: 'Mentorship', icon: GraduationCap },
  { to: '/startupvarsity', label: 'StartupVarsity', icon: Rocket },
  { to: '/news', label: 'News & Updates', icon: Newspaper },
  { to: '/explore', label: 'Explore Communities', icon: Compass },
]

export function LeftSidebar() {
  const { communities, currentUser } = useApp()
  const navigate = useNavigate()
  const joined = communities.filter((c) => c.joined)

  return (
    <aside className="fixed bottom-0 left-[var(--shell-gutter)] top-14 hidden w-[260px] overflow-y-auto border-r border-[#edeff1] bg-white px-3 py-4 lg:block">
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-[#ff4500] bg-orange-50 text-[#ff4500]'
                  : 'border-transparent text-[#1c1c1c] hover:bg-gray-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className={isActive ? 'text-[#ff4500]' : 'text-[#878a8c]'} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={() => navigate('/explore', { state: { create: true } })}
          className="mt-1 flex items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3 py-2 text-sm font-medium text-[#1c1c1c] hover:bg-gray-100"
        >
          <Plus size={20} className="text-[#878a8c]" />
          Start a Community
        </button>

        {/* Console entry — admins only */}
        {currentUser.isAdmin && (
          <NavLink
            to="/admin"
            className="mt-1 flex items-center gap-3 rounded-lg border-l-[3px] border-transparent bg-orange-50/60 px-3 py-2 text-sm font-semibold text-[#ff4500] hover:bg-orange-50"
          >
            <ShieldCheck size={20} />
            Admin Console
          </NavLink>
        )}
      </nav>

      <div className="my-4 border-t border-[#edeff1]" />

      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-[#878a8c]">
        My Communities
      </p>
      <div className="flex flex-col gap-0.5">
        {joined.map((c) => (
          <NavLink
            key={c.id}
            to={`/community/${c.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-orange-50 text-[#ff4500]' : 'text-[#1c1c1c] hover:bg-gray-100'
              }`
            }
          >
            <span className={`h-6 w-6 shrink-0 rounded-full bg-gradient-to-br ${c.color}`} />
            <span className="truncate">{c.name}</span>
          </NavLink>
        ))}
        {joined.length === 0 && (
          <p className="px-3 text-xs text-[#878a8c]">You haven’t joined any communities yet.</p>
        )}
      </div>
    </aside>
  )
}
