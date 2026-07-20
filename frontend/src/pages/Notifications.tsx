import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar,
  Bell,
  Briefcase,
  Heart,
  Megaphone,
  MessageCircle,
  UserPlus,
  Users,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { NOTIFICATION_ROUTES } from '../components/layout/NotificationsDropdown'
import { Avatar, Button, Card } from '../components/ui'
import { timeAgo } from '../lib/format'
import type { NotificationType } from '../types'

const ICONS: Record<NotificationType, typeof Bell> = {
  connection: UserPlus,
  like: Heart,
  comment: MessageCircle,
  job: Briefcase,
  mentorship: Users,
  community: Users,
  announcement: Megaphone,
  event: Calendar,
}

export function Notifications() {
  const { notifications, markNotificationsRead, userById, pendingRequestIds, acceptRequest, ignoreRequest } = useApp()
  const navigate = useNavigate()

  // Mark everything read once the page is opened.
  useEffect(() => {
    markNotificationsRead()
  }, [markNotificationsRead])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1c1c1c]">Notifications</h1>
      </div>

      {/* Connection requests inline */}
      {pendingRequestIds.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold text-[#1c1c1c]">Connection Requests</h2>
          <div className="flex flex-col gap-3">
            {pendingRequestIds.map((rid) => {
              const u = userById(rid)
              if (!u) return null
              return (
                <div key={rid} className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.photo} size={40} to={`/profile/${u.id}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1c1c1c]">{u.name}</p>
                    <p className="truncate text-xs text-[#878a8c]">{u.designation}</p>
                  </div>
                  <Button className="!px-3 !py-1.5 text-xs" onClick={() => acceptRequest(rid)}>Accept</Button>
                  <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => ignoreRequest(rid)}>Ignore</Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        {notifications.map((n, i) => {
          const Icon = ICONS[n.type]
          const actor = n.actorId ? userById(n.actorId) : undefined
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(NOTIFICATION_ROUTES[n.type])}
              onKeyDown={(e) => e.key === 'Enter' && navigate(NOTIFICATION_ROUTES[n.type])}
              className={`flex cursor-pointer gap-3 px-4 py-3.5 hover:bg-gray-50 ${i < notifications.length - 1 ? 'border-b border-[#edeff1]' : ''}`}
            >
              {actor ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <Avatar name={actor.name} src={actor.photo} size={40} to={`/profile/${actor.id}`} />
                </span>
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#ff4500]">
                  <Icon size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#1c1c1c]">{n.text}</p>
                <p className="mt-0.5 text-xs text-[#878a8c]">{timeAgo(n.createdAt)}</p>
              </div>
              <span className="mt-1 text-[#878a8c]"><Icon size={16} /></span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
