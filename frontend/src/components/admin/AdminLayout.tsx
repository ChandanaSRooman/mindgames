import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Flag, CalendarCheck, Compass, LayoutDashboard, Users, Megaphone, GraduationCap, Rocket, Settings, ArrowLeft } from 'lucide-react'
import { cx } from '../ui'

export type AdminView = 'dashboard' | 'directory' | 'announcements' | 'mentors' | 'startups' | 'communities' | 'events' | 'reports' | 'settings'

const NAV: Array<{ key: AdminView; label: string; icon: ReactNode }> = [
  { key: 'dashboard', label: 'Invitations', icon: <LayoutDashboard size={18} /> },
  { key: 'directory', label: 'Alumni Directory', icon: <Users size={18} /> },
  { key: 'announcements', label: 'News & Announcements', icon: <Megaphone size={18} /> },
  { key: 'mentors', label: 'Mentor Approvals', icon: <GraduationCap size={18} /> },
  { key: 'startups', label: 'Startup Applications', icon: <Rocket size={18} /> },
  { key: 'communities', label: 'Community Approvals', icon: <Compass size={18} /> },
  { key: 'events', label: 'Event Approvals', icon: <CalendarCheck size={18} /> },
  { key: 'reports', label: 'Reports', icon: <Flag size={18} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={18} /> },
]

export function AdminLayout({
  view,
  onViewChange,
  stats,
  children,
}: {
  view: AdminView
  onViewChange: (v: AdminView) => void
  stats: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#f6f7f8] text-[#1c1c1c]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#edeff1] bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-[#edeff1] px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff4500] text-lg font-black text-white">R</span>
          <div>
            <p className="text-sm font-bold text-[#1c1c1c]">Rooman Admin</p>
            <p className="text-xs text-[#878a8c]">Alumni Network</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={cx(
                'flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors',
                view === item.key
                  ? 'border-[#ff4500] bg-orange-50 text-[#ff4500]'
                  : 'border-transparent text-[#1c1c1c] hover:bg-gray-100',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <Link
          to="/home"
          className="flex items-center gap-2 border-t border-[#edeff1] p-4 text-xs font-medium text-[#878a8c] hover:text-[#ff4500]"
        >
          <ArrowLeft size={14} /> Back to network
        </Link>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#edeff1] bg-white px-4 py-4 md:px-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-bold text-[#1c1c1c]">{NAV.find((n) => n.key === view)?.label}</h1>
            <div className="flex gap-1 md:hidden">
              {NAV.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onViewChange(item.key)}
                  aria-label={item.label}
                  className={cx('rounded-lg p-2', view === item.key ? 'bg-orange-50 text-[#ff4500]' : 'text-[#878a8c]')}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>
          {stats}
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
