import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Briefcase,
  GraduationCap,
  MapPin,
  MessageSquare,
  Flag,
  Handshake,
  UserPlus,
  Edit2,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useLayout } from '../components/layout/LayoutContext'
import { Button, Card, VerifiedBadge, cx } from '../components/ui'
import { PostCard } from '../components/feed/PostCard'
import { EditProfileModal } from '../components/profile/EditProfileModal'
import { ProfilePhoto } from '../components/profile/ProfilePhoto'
import { ProfileBadges } from '../components/profile/ProfileBadges'
import { ProfileCompletenessMeter } from '../components/profile/ProfileCompletenessMeter'
import {
  AboutSection,
  AchievementsSection,
  CertificationsSection,
  DetailsSection,
  EducationSection,
  ExperienceSection,
  MentorshipSection,
  OpenToSection,
  PrivateSection,
  ProjectsSection,
} from '../components/profile/ProfileSections'
import { ReportModal } from '../components/ReportModal'
import { ConnectNoteModal } from '../components/referral/ConnectNoteModal'
import { ReachOutModal } from '../components/referral/ReachOutModal'
import { CountUp, HoverLift, Reveal, motion } from '../components/profile/motion'
import { roleLine } from '../lib/format'
import { api } from '../lib/api'
import { type Badge } from '../types'

type Tab = 'overview' | 'posts' | 'about'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About' },
]

export function Profile() {
  const { id } = useParams<{ id: string }>()
  const { currentUser, userById, posts, connectionState, updateProfile, notify } = useApp()
  const [showReferral, setShowReferral] = useState(false)
  const [reportingUser, setReportingUser] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const navigate = useNavigate()
  const { openComposer, openChatWith } = useLayout()
  const [editing, setEditing] = useState(false)

  const targetId = id ?? currentUser.id
  const user = userById(targetId)
  const isMe = targetId === currentUser.id

  const userPosts = useMemo(() => posts.filter((p) => p.authorId === targetId), [posts, targetId])

  // Reset to Overview when moving between profiles, so a tab chosen on one
  // person's page doesn't carry over to the next.
  useEffect(() => setTab('overview'), [targetId])

  if (!user) return <Navigate to="/home" replace />

  const conn = connectionState(user.id)
  const openEditor = () => setEditing(true)

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Hero: banner, overlapping avatar, identity, actions -----------
          LinkedIn's arrangement, with a mesh-gradient banner instead of a flat
          bar so the page doesn't open on a solid orange slab. */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-xl border border-[#edeff1] bg-white shadow-sm"
      >
        <div className="relative h-32 overflow-hidden bg-[#1c1c1c]">
          {/* Three offset radial washes read as depth where one linear
              gradient reads as a printed band. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 140% at 8% 0%, #ff6534 0%, transparent 55%),' +
                'radial-gradient(90% 120% at 95% 20%, #ff4500 0%, transparent 60%),' +
                'radial-gradient(80% 100% at 60% 120%, #7c2d12 0%, transparent 70%)',
            }}
          />
          {/* Slow drift, so the header is alive without demanding attention. */}
          <motion.div
            aria-hidden
            className="absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/15 blur-2xl"
            animate={{ x: [0, 18, 0], y: [0, 10, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="px-5 pb-5">
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 220, damping: 18 }}
            className="-mt-12 inline-block rounded-full ring-4 ring-white"
          >
            <ProfilePhoto
              name={user.name}
              photo={user.photo}
              size={88}
              canEdit={isMe}
              onChange={async (photo) => {
                try {
                  await updateProfile({ photo })
                  notify(photo ? 'Profile photo updated.' : 'Profile photo removed.')
                } catch {
                  notify('Could not update your photo. Try again.', 'error')
                }
              }}
            />
          </motion.span>

          <div className="mt-3">
            <h1 className="flex items-center gap-1.5 text-xl font-bold text-[#1c1c1c]">
              {user.name}
              <VerifiedBadge verified={user.emailVerified} size={18} />
            </h1>
            {roleLine(user) && (
              <p className="text-sm font-medium text-[#1c1c1c]">{roleLine(user)}</p>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#878a8c]">
              {user.city && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {user.city}
                </span>
              )}
              <span className="flex items-center gap-1">
                <GraduationCap size={12} /> Batch {user.batchYear} · {user.course}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase size={12} />
                {user.experienceYears > 0 ? `${user.experienceYears} yrs · ` : ''}
                {user.domain}
              </span>
            </p>
          </div>

          {/* Labels follow the member's own answers — nothing to pick by hand. */}
          <div className="mt-3">
            <ProfileBadges user={user} />
          </div>

          {/* ---- Stat tiles, borrowed from Reddit ------------------------- */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={user.connectionsCount} label="Connections" />
            <Stat value={userPosts.length} label={userPosts.length === 1 ? 'Post' : 'Posts'} />
            <Stat value={user.sessionsConducted ?? 0} label="Sessions" />
            <Stat value={(user.experience ?? []).length} label="Roles" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isMe ? (
              <Button variant="outline" icon={<Edit2 size={15} />} onClick={openEditor}>
                Edit Profile
              </Button>
            ) : (
              <>
                <Button
                  icon={<UserPlus size={15} />}
                  variant={conn === 'none' ? 'primary' : 'subtle'}
                  disabled={conn !== 'none'}
                  onClick={() => setShowNoteModal(true)}
                >
                  {conn === 'connected'
                    ? 'Connected'
                    : conn === 'pending'
                      ? 'Request sent'
                      : 'Send Note'}
                </Button>
                <Button
                  variant="outline"
                  icon={<MessageSquare size={15} />}
                  onClick={() => openChatWith(user.id)}
                >
                  Message
                </Button>
                {user.company && (
                  <Button
                    variant="subtle"
                    icon={<Handshake size={15} />}
                    onClick={() => setShowReferral(true)}
                  >
                    Request Referral
                  </Button>
                )}
                <button
                  onClick={() => setReportingUser(true)}
                  className="ml-auto rounded-full p-2 text-[#c3c6c9] transition-colors hover:bg-red-50 hover:text-red-500"
                  title={`Report ${user.name}`}
                  aria-label={`Report ${user.name}`}
                >
                  <Flag size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ---- Tabs, borrowed from Reddit: three short pages instead of one
          very long scroll. Sticky under the 56px app header. */}
      <div className="sticky top-14 z-10 -mx-4 border-b border-[#edeff1] bg-[#f6f7f8]/95 px-4 backdrop-blur">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={cx(
                'relative px-4 py-3 text-sm font-semibold transition-colors',
                tab === t.key ? 'text-[#ff4500]' : 'text-[#878a8c] hover:text-[#1c1c1c]',
              )}
            >
              {t.label}
              {t.key === 'posts' && userPosts.length > 0 && (
                <span className="ml-1.5 text-xs font-normal">{userPosts.length}</span>
              )}
              {tab === t.key && (
                // layoutId lets the underline travel between tabs instead of
                // disappearing and reappearing.
                <motion.span
                  layoutId="profile-tab-underline"
                  className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-[#ff4500]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        // Each section fades up as it reaches the viewport, staggered so the
        // column arrives as a cascade. `key` is the section list index.
        <div className="flex flex-col gap-4">
          {[
            isMe ? (
              <ProfileCompletenessMeter
                user={user}
                postCount={userPosts.length}
                onEdit={openEditor}
              />
            ) : null,
            <AboutSection user={user} isMe={isMe} onAdd={openEditor} />,
            <MentorshipSection
              user={user}
              onBook={isMe ? undefined : () => navigate('/mentorship')}
            />,
            <ExperienceSection user={user} isMe={isMe} onAdd={openEditor} />,
            <EducationSection user={user} isMe={isMe} onAdd={openEditor} />,
            <ProjectsSection user={user} isMe={isMe} onAdd={openEditor} />,
            <CertificationsSection user={user} isMe={isMe} onAdd={openEditor} />,
            <AchievementsSection user={user} isMe={isMe} onAdd={openEditor} />,
            <OpenToSection user={user} />,
            <BadgesCard userId={user.id} isMe={isMe} />,
          ].map((node, i) =>
            node ? (
              <Reveal key={i} index={i}>
                {node}
              </Reveal>
            ) : null,
          )}
        </div>
      )}

      {tab === 'posts' && (
        <>
          {isMe && (
            <Button variant="outline" className="self-start" onClick={() => openComposer()}>
              New Post
            </Button>
          )}
          {userPosts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {userPosts.length === 0 && (
            <div className="rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
              {isMe ? "You haven't posted yet." : 'No posts yet.'}
            </div>
          )}
        </>
      )}

      {tab === 'about' && <AboutTab user={user} isMe={isMe} onEdit={openEditor} />}

      {reportingUser && (
        <ReportModal
          targetType="user"
          targetId={user.id}
          targetLabel={user.name}
          onClose={() => setReportingUser(false)}
        />
      )}
      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
      {showReferral && <ReachOutModal user={user} onClose={() => setShowReferral(false)} />}
      {showNoteModal && <ConnectNoteModal user={user} onClose={() => setShowNoteModal(false)} />}
    </div>
  )
}

/** One tile in the stat strip. Counts up the first time it's seen. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <HoverLift className="rounded-lg bg-[#f6f7f8] px-3 py-2 text-center">
      <CountUp to={value} className="block text-lg font-bold leading-tight text-[#1c1c1c]" />
      <span className="text-[11px] font-medium tracking-wide text-[#878a8c] uppercase">
        {label}
      </span>
    </HoverLift>
  )
}

/**
 * Contact, links and preferences — plus the owner-only block. Both halves can
 * be empty, so the tab falls back to a prompt rather than a blank screen.
 */
function AboutTab({
  user,
  isMe,
  onEdit,
}: {
  user: Parameters<typeof DetailsSection>[0]['user']
  isMe: boolean
  onEdit: () => void
}) {
  const hasDetails =
    !!user.linkedin ||
    !!user.github ||
    !!user.portfolio ||
    !!user.industry ||
    !!user.roomanCenter ||
    !!user.email ||
    !!user.phone ||
    (user.languagesKnown ?? []).length > 0 ||
    (user.interests ?? []).length > 0

  return (
    <>
      <DetailsSection user={user} />
      {isMe && <PrivateSection user={user} />}
      {!hasDetails && (
        <div className="rounded-xl border border-[#edeff1] bg-white py-12 text-center text-sm text-[#878a8c] shadow-sm">
          {isMe ? (
            <>
              Nothing here yet.{' '}
              <button onClick={onEdit} className="font-semibold text-[#ff4500] hover:underline">
                Add your links and details
              </button>
            </>
          ) : (
            'No details shared.'
          )}
        </div>
      )}
    </>
  )
}

/** Computed badges + activity points, fetched per profile. */
function BadgesCard({ userId, isMe }: { userId: string; isMe: boolean }) {
  const [data, setData] = useState<{ points: number; badges: Badge[] } | null>(null)

  useEffect(() => {
    setData(null)
    api.getBadges(userId).then(setData, () => setData(null))
  }, [userId])

  const earned = data?.badges.filter((b) => b.earned) ?? []
  if (!data || earned.length === 0) return null

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1c1c1c]">Badges</h2>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#ff4500]">
          ⭐ {data.points} points
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {earned.map((b) => (
          <span
            key={b.id}
            title={b.description}
            className="flex cursor-default items-center gap-1.5 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-3 py-1.5 text-sm font-semibold text-[#1c1c1c]"
          >
            <span>{b.emoji}</span> {b.label}
          </span>
        ))}
      </div>
      {isMe && data.badges.some((b) => !b.earned) && (
        <p className="mt-3 text-xs text-[#878a8c]">
          {data.badges.filter((b) => b.earned).length}/{data.badges.length} earned — keep posting,
          connecting and mentoring to unlock the rest.
        </p>
      )}
    </Card>
  )
}
