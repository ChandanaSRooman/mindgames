import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Compass,
  GraduationCap,
  Home,
  Newspaper,
  Rocket,
  Route,
  ShieldCheck,
  Users,
  Menu,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { useLayout } from './LayoutContext'
import { VerifyEmailNotice } from './VerifyEmailNotice'

const NAV = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/network', label: 'My Network', icon: Users },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/jobs', label: 'Jobs & Opportunities', icon: Briefcase },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/mentorship', label: 'Mentorship', icon: GraduationCap },
  { to: '/startupvarsity', label: 'StartupVarsity', icon: Rocket },
  { to: '/news', label: 'News & Updates', icon: Newspaper },
  { to: '/learning-resources', label: 'Learning Resources', icon: BookOpen },
  { to: '/career-guidance', label: 'Career Guidance', icon: Route },
  // Explore and "Start a Community" are one entry: the Explore page already
  // has its own Start a Community button, so a separate sidebar item was a
  // second door to the same room.
  { to: '/explore', label: 'Explore Communities', icon: Compass },
]

export function LeftSidebar({
  verifyNotice,
}: {
  /** Set while the member's email is unverified and the prompt isn't dismissed. */
  verifyNotice?: { resending: boolean; onResend: () => void; onDismiss: () => void }
} = {}) {
  const { communities, currentUser } = useApp()
  const { sidebarOpen, toggleSidebar } = useLayout()
  const joined = communities.filter((c) => c.joined)

  return (
    <>
      {/*
        Collapse handle — a circular button that straddles the sidebar's right
        border. When the sidebar is closed it parks at the left edge so it can
        be reopened. Lives outside <aside> because that scrolls and would clip it.
      */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-20 z-50 hidden h-9 w-9 items-center justify-center rounded-full border border-[#edeff1] bg-white text-[#878a8c] shadow-sm transition-all duration-200 hover:bg-gray-100 hover:text-[#1c1c1c] lg:flex ${
          sidebarOpen
            ? 'left-[calc(var(--shell-gutter)+260px-18px)]'
            : 'left-[calc(var(--shell-gutter)+8px)]'
        }`}
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        aria-expanded={sidebarOpen}
      >
        <Menu size={18} />
      </button>

      {/* Sidebar — slides fully off-screen when closed */}
      <aside className={`fixed bottom-0 top-14 z-40 hidden w-[260px] flex-col overflow-y-auto border-r border-[#edeff1] bg-white px-3 py-4 transition-all duration-200 lg:flex ${
        sidebarOpen ? 'left-[var(--shell-gutter)]' : '-left-[280px]'
      }`}>
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

      {joined.length > 0 && (
        <>
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
          </div>
        </>
      )}

      {/* mt-auto pushes it to the bottom of the sidebar; when the nav is
          taller than the screen it simply follows it as the last item. */}
      {verifyNotice && (
        <div className="mt-auto pt-4">
          <VerifyEmailNotice compact {...verifyNotice} />
        </div>
      )}
    </aside>
    </>
  )
}
