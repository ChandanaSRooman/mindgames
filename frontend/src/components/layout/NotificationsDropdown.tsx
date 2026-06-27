import { Link } from 'react-router-dom'
import {
  Bell,
  Briefcase,
  Heart,
  MessageCircle,
  Megaphone,
  UserPlus,
  Users,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { timeAgo } from '../../lib/format'
import type { NotificationType } from '../../types'

const ICONS: Record<NotificationType, typeof Bell> = {
  connection: UserPlus,
  like: Heart,
  comment: MessageCircle,
  job: Briefcase,
  mentorship: Users,
  community: Users,
  announcement: Megaphone,
}

export function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const { notifications, markNotificationsRead } = useApp()
  const recent = notifications.slice(0, 5)

  return (
    <div className="animate-fadein absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-[#edeff1] bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-[#edeff1] px-4 py-3">
        <h3 className="font-bold text-[#1c1c1c]">Notifications</h3>
        <button onClick={markNotificationsRead} className="text-xs font-semibold text-[#ff4500] hover:underline">
          Mark all read
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {recent.map((n) => {
          const Icon = ICONS[n.type]
          return (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3 hover:bg-gray-50 ${n.read ? '' : 'bg-orange-50/60'}`}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#ff4500]">
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-[#1c1c1c]">{n.text}</p>
                <p className="mt-0.5 text-xs text-[#878a8c]">{timeAgo(n.createdAt)}</p>
              </div>
            </div>
          )
        })}
      </div>
      <Link
        to="/notifications"
        onClick={onClose}
        className="block border-t border-[#edeff1] py-2.5 text-center text-sm font-semibold text-[#ff4500] hover:bg-gray-50"
      >
        See all notifications
      </Link>
    </div>
  )
}
