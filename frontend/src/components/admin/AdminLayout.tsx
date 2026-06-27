import type { ReactNode } from 'react'
import { LayoutDashboard, Users, Settings, GraduationCap } from 'lucide-react'
import { cx } from '../ui'

export type AdminView = 'dashboard' | 'directory' | 'settings'

const NAV: Array<{ key: AdminView; label: string; icon: ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'directory', label: 'Alumni Directory', icon: <Users size={18} /> },
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
    <div className="flex min-h-screen bg-navy-950 text-slate-200">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-800 bg-navy-900 md:flex">
        <div className="flex items-center gap-2.5 border-b border-navy-800 px-6 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 text-navy-950">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Rooman</p>
            <p className="text-xs text-slate-400">Alumni Network</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                view === item.key
                  ? 'bg-teal-500/15 text-teal-300'
                  : 'text-slate-400 hover:bg-navy-800 hover:text-slate-200',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-navy-800 p-4 text-xs text-slate-500">Admin Console v0.1</div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar with mobile nav + summary stats */}
        <header className="border-b border-navy-800 bg-navy-900/80 px-4 py-4 backdrop-blur md:px-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-white">
              {NAV.find((n) => n.key === view)?.label}
            </h1>
            {/* Mobile nav */}
            <div className="flex gap-1 md:hidden">
              {NAV.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onViewChange(item.key)}
                  aria-label={item.label}
                  className={cx(
                    'rounded-lg p-2',
                    view === item.key ? 'bg-teal-500/15 text-teal-300' : 'text-slate-400',
                  )}
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
