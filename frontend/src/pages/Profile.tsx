import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Award,
  Briefcase,
  GraduationCap,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  UserPlus,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useLayout } from '../components/layout/LayoutContext'
import { Avatar, Button, Card } from '../components/ui'
import { PostCard } from '../components/feed/PostCard'
import { EditProfileModal } from '../components/profile/EditProfileModal'
import { compact } from '../lib/format'

export function Profile() {
  const { id } = useParams<{ id: string }>()
  const { currentUser, userById, posts, connectionState, sendConnect } = useApp()
  const navigate = useNavigate()
  const { openComposer, openChatWith } = useLayout()
  const [editing, setEditing] = useState(false)

  const targetId = id ?? currentUser.id
  const user = userById(targetId)
  const isMe = targetId === currentUser.id

  const userPosts = useMemo(() => posts.filter((p) => p.authorId === targetId), [posts, targetId])

  if (!user) return <Navigate to="/home" replace />

  const conn = connectionState(user.id)

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-[#ff4500] to-[#ff6534]" />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between">
            <span className="rounded-full ring-4 ring-white">
              <Avatar name={user.name} size={88} />
            </span>
            {user.isMentor && (
              <span className="mb-2 flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-[#ff4500]">
                <Award size={14} /> Mentor
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#1c1c1c]">{user.name}</h1>
              <p className="text-sm text-[#1c1c1c]">{user.designation} · {user.company}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#878a8c]">
                <span className="flex items-center gap-1"><MapPin size={12} /> {user.city}</span>
                <span className="flex items-center gap-1"><GraduationCap size={12} /> Batch {user.batchYear} · {user.course}</span>
                <span className="flex items-center gap-1"><Briefcase size={12} /> {user.experienceYears} yrs · {user.domain}</span>
              </p>
              <p className="mt-1 text-xs font-medium text-[#1c1c1c]">{compact(user.connectionsCount)} connections</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isMe ? (
                <Button variant="outline" onClick={() => setEditing(true)}>Edit Profile</Button>
              ) : (
                <>
                  <Button
                    icon={<UserPlus size={15} />}
                    variant={conn === 'none' ? 'primary' : 'subtle'}
                    disabled={conn !== 'none'}
                    onClick={() => sendConnect(user.id)}
                  >
                    {conn === 'connected' ? 'Connected' : conn === 'pending' ? 'Request sent' : 'Connect'}
                  </Button>
                  <Button variant="outline" icon={<MessageSquare size={15} />} onClick={() => openChatWith(user.id)}>Message</Button>
                  {user.isMentor && (
                    <Button variant="ghost" className="!text-[#ff4500]" onClick={() => navigate('/mentorship')}>
                      Book Session
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bio */}
          <p className="mt-4 text-sm leading-relaxed text-[#1c1c1c]">{user.bio}</p>

          {/* Expertise */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {user.expertise.map((e) => (
              <span key={e} className="rounded-full bg-[#f6f7f8] px-2.5 py-1 text-xs font-medium text-[#878a8c]">{e}</span>
            ))}
          </div>

          {user.linkedin && (
            <a href={user.linkedin} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#ff4500] hover:underline">
              <LinkIcon size={14} /> LinkedIn
            </a>
          )}
        </div>
      </Card>

      {/* Posts */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1c1c1c]">{isMe ? 'Your Posts' : 'Posts'}</h2>
        {isMe && <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openComposer()}>New Post</Button>}
      </div>
      {userPosts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {userPosts.length === 0 && (
        <div className="rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
          No posts yet.
        </div>
      )}

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </div>
  )
}
