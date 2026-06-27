import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  User as UserIcon,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { useLayout } from './LayoutContext'
import { Avatar } from '../ui'
import { NotificationsDropdown } from './NotificationsDropdown'

export function Navbar() {
  const { currentUser, query, setQuery, unreadNotifications, unreadMessages, notify } = useApp()
  const { openComposer, toggleChat } = useLayout()
  const navigate = useNavigate()

  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-[#edeff1] bg-white px-4">
      {/* Logo */}
      <Link to="/home" className="flex shrink-0 items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff4500] text-lg font-black text-white">
          R
        </span>
        <span className="hidden text-[15px] font-bold text-[#1c1c1c] sm:block">
          Roo<span className="text-[#ff4500]">Connect</span>
          <span className="ml-1.5 hidden text-xs font-medium text-[#878a8c] lg:inline">Alumni Network</span>
        </span>
      </Link>

      {/* Search + Ask AI */}
      <div className="mx-auto flex w-full max-w-2xl items-center">
        <div className="flex w-full items-center rounded-full border border-[#edeff1] bg-[#f6f7f8] pl-4 focus-within:border-[#ff4500] focus-within:ring-2 focus-within:ring-orange-100">
          <Search size={18} className="text-[#878a8c]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search alumni, jobs, mentors, posts..."
            className="w-full bg-transparent px-3 py-2 text-sm text-[#1c1c1c] outline-none placeholder:text-[#878a8c]"
          />
          <button
            onClick={() => notify('Ask AI is a demo — coming soon!', 'info')}
            className="m-1 hidden items-center gap-1.5 rounded-full bg-[#ff4500] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff6534] sm:flex"
          >
            <Sparkles size={14} /> Ask AI
          </button>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="Messages" badge={unreadMessages} onClick={toggleChat}>
          <MessageSquare size={20} />
        </IconButton>

        <div ref={notifRef} className="relative">
          <IconButton
            label="Notifications"
            badge={unreadNotifications}
            onClick={() => setShowNotifs((v) => !v)}
          >
            <Bell size={20} />
          </IconButton>
          {showNotifs && <NotificationsDropdown onClose={() => setShowNotifs(false)} />}
        </div>

        <button
          onClick={() => openComposer()}
          className="ml-1 flex items-center gap-1.5 rounded-full bg-[#ff4500] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ff6534]"
        >
          <Plus size={18} /> <span className="hidden md:inline">Create Post</span>
        </button>

        <div ref={profileRef} className="relative ml-1">
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-1 rounded-full p-0.5 hover:bg-gray-100"
          >
            <Avatar name={currentUser.name} size={32} />
            <ChevronDown size={16} className="text-[#878a8c]" />
          </button>
          {showProfile && (
            <div className="animate-fadein absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-[#edeff1] bg-white shadow-lg">
              <div className="flex items-center gap-3 border-b border-[#edeff1] p-4">
                <Avatar name={currentUser.name} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1c1c1c]">{currentUser.name}</p>
                  <p className="truncate text-xs text-[#878a8c]">{currentUser.designation}</p>
                </div>
              </div>
              <MenuItem icon={<UserIcon size={16} />} label="View Profile" onClick={() => { setShowProfile(false); navigate('/profile') }} />
              <MenuItem icon={<Settings size={16} />} label="Settings" onClick={() => { setShowProfile(false); notify('Settings is a demo.', 'info') }} />
              <MenuItem icon={<LogOut size={16} />} label="Sign out" onClick={() => { setShowProfile(false); navigate('/') }} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function IconButton({
  children,
  label,
  badge = 0,
  onClick,
}: {
  children: React.ReactNode
  label: string
  badge?: number
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#878a8c] hover:bg-gray-100 hover:text-[#1c1c1c]"
    >
      {children}
      {badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff4500] px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#1c1c1c] hover:bg-gray-50"
    >
      <span className="text-[#878a8c]">{icon}</span>
      {label}
    </button>
  )
}
