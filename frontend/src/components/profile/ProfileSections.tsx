// The read-only sections of a profile.
//
// Layout borrows from the two profiles people already know:
//   - LinkedIn, for the shape of a section — icon + title, entries as a
//     timeline with an initial badge per organisation, long lists collapsed
//     behind "Show all", and an "Add …" prompt on your own empty sections
//     instead of the section simply not existing.
//   - Reddit, for density — a compact stat strip and tabs instead of one
//     endless scroll.
//
// A section renders nothing on someone else's profile when it is empty, so a
// sparse profile reads as deliberate rather than broken.

import { useState, type ReactNode } from 'react'
import {
  Award,
  BadgeCheck,
  Cake,
  Briefcase,
  Code2,
  Globe,
  GraduationCap,
  Handshake,
  Home,
  Languages,
  Lightbulb,
  Link as LinkIcon,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Rocket,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { Card } from '../ui'
import { HoverLift, motion } from './motion'
import type { User } from '../../types'

/** How many entries a section shows before collapsing the rest. */
const COLLAPSE_AFTER = 3

export function Section({
  icon,
  title,
  count,
  isMe,
  /** Shown in place of the body when empty and it's your own profile. */
  emptyPrompt,
  onAdd,
  children,
}: {
  icon: ReactNode
  title: string
  count?: number
  isMe?: boolean
  emptyPrompt?: string
  onAdd?: () => void
  children?: ReactNode
}) {
  const empty = !children
  // Someone else's empty section is simply absent; your own becomes a prompt.
  if (empty && !(isMe && emptyPrompt)) return null

  return (
    <HoverLift>
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
          <motion.span
            className="text-[#ff4500]"
            whileHover={{ rotate: -8, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            {icon}
          </motion.span>
          {title}
          {!!count && count > 1 && (
            <span className="rounded-full bg-[#f6f7f8] px-2 py-0.5 text-xs font-semibold text-[#878a8c]">
              {count}
            </span>
          )}
        </h2>
        {isMe && onAdd && !empty && (
          <button
            onClick={onAdd}
            aria-label={`Add to ${title}`}
            className="rounded-full p-1.5 text-[#878a8c] hover:bg-[#f6f7f8] hover:text-[#1c1c1c]"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {empty ? (
        <button
          onClick={onAdd}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#edeff1] py-3 text-sm font-medium text-[#ff4500] hover:bg-orange-50"
        >
          <Plus size={14} /> {emptyPrompt}
        </button>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </Card>
    </HoverLift>
  )
}

/** Collapses a long list behind a "Show all N" toggle, LinkedIn-style. */
function Collapsible<T>({
  items,
  render,
  noun,
}: {
  items: T[]
  render: (item: T, i: number) => ReactNode
  noun: string
}) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, COLLAPSE_AFTER)
  return (
    <>
      {/* layout: expanding the list pushes the rest of the card down smoothly
          instead of jumping. */}
      <motion.div layout className="flex flex-col">
        {shown.map(render)}
      </motion.div>
      {items.length > COLLAPSE_AFTER && (
        <button
          onClick={() => setAll((a) => !a)}
          className="mt-1 w-full border-t border-[#edeff1] pt-3 text-sm font-semibold text-[#878a8c] hover:text-[#1c1c1c]"
        >
          {all ? 'Show less' : `Show all ${items.length} ${noun}`}
        </button>
      )}
    </>
  )
}

/** Square initial badge standing in for an organisation logo. */
function OrgBadge({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#f6f7f8] text-sm font-bold text-[#878a8c]"
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i}
          className="rounded-full bg-[#f6f7f8] px-2.5 py-1 text-xs font-medium text-[#878a8c]"
        >
          {i}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function AboutSection({
  user,
  isMe,
  onAdd,
}: {
  user: User
  isMe: boolean
  onAdd: () => void
}) {
  const hasBio = !!user.bio?.trim()
  const skills = user.expertise ?? []
  return (
    <Section
      icon={<Sparkles size={17} />}
      title="About"
      isMe={isMe}
      emptyPrompt="Write your bio and add your skills"
      onAdd={onAdd}
    >
      {hasBio || skills.length > 0 ? (
        <>
          {hasBio && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-[#1c1c1c]">{user.bio}</p>
          )}
          {skills.length > 0 && (
            <div className={hasBio ? 'mt-3' : ''}>
              <Chips items={skills} />
            </div>
          )}
        </>
      ) : undefined}
    </Section>
  )
}

export function ExperienceSection({
  user,
  isMe,
  onAdd,
}: {
  user: User
  isMe: boolean
  onAdd: () => void
}) {
  const items = user.experience ?? []
  return (
    <Section
      icon={<Briefcase size={17} />}
      title="Experience"
      count={items.length}
      isMe={isMe}
      emptyPrompt="Add your work experience"
      onAdd={onAdd}
    >
      {items.length > 0 ? (
        <Collapsible
          items={items}
          noun="roles"
          render={(e, i) => (
            <div key={i} className="flex gap-3 border-b border-[#edeff1] py-3 first:pt-0 last:border-0 last:pb-0">
              <OrgBadge name={e.company} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1c1c1c]">{e.role}</p>
                <p className="text-sm text-[#1c1c1c]/80">{e.company}</p>
                {e.period && <p className="text-xs text-[#878a8c]">{e.period}</p>}
                {e.summary && (
                  <p className="mt-1 text-xs leading-relaxed text-[#878a8c]">{e.summary}</p>
                )}
              </div>
            </div>
          )}
        />
      ) : undefined}
    </Section>
  )
}

export function EducationSection({
  user,
  isMe,
  onAdd,
}: {
  user: User
  isMe: boolean
  onAdd: () => void
}) {
  const items = user.education ?? []
  return (
    <Section
      icon={<GraduationCap size={17} />}
      title="Education"
      count={items.length}
      isMe={isMe}
      emptyPrompt="Add your degree or diploma"
      onAdd={onAdd}
    >
      {items.length > 0 ? (
        <Collapsible
          items={items}
          noun="qualifications"
          render={(e, i) => (
            <div key={i} className="flex gap-3 border-b border-[#edeff1] py-3 first:pt-0 last:border-0 last:pb-0">
              <OrgBadge name={e.institution} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1c1c1c]">{e.degree}</p>
                <p className="text-sm text-[#1c1c1c]/80">{e.institution}</p>
                <p className="text-xs text-[#878a8c]">
                  {[e.year, e.score].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}
        />
      ) : undefined}
    </Section>
  )
}

export function ProjectsSection({
  user,
  isMe,
  onAdd,
}: {
  user: User
  isMe: boolean
  onAdd: () => void
}) {
  const items = user.projects ?? []
  return (
    <Section
      icon={<Lightbulb size={17} />}
      title="Projects"
      count={items.length}
      isMe={isMe}
      emptyPrompt="Add a project you have built"
      onAdd={onAdd}
    >
      {items.length > 0 ? (
        <Collapsible
          items={items}
          noun="projects"
          render={(p, i) => (
            <div key={i} className="border-b border-[#edeff1] py-3 first:pt-0 last:border-0 last:pb-0">
              <p className="text-sm font-semibold text-[#1c1c1c]">
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#ff4500] hover:underline"
                  >
                    {p.title}
                  </a>
                ) : (
                  p.title
                )}
              </p>
              {p.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-[#878a8c]">{p.description}</p>
              )}
              {p.tech.length > 0 && (
                <div className="mt-1.5">
                  <Chips items={p.tech} />
                </div>
              )}
            </div>
          )}
        />
      ) : undefined}
    </Section>
  )
}

export function CertificationsSection({
  user,
  isMe,
  onAdd,
}: {
  user: User
  isMe: boolean
  onAdd: () => void
}) {
  const items = user.certifications ?? []
  return (
    <Section
      icon={<BadgeCheck size={17} />}
      title="Certifications"
      count={items.length}
      isMe={isMe}
      emptyPrompt="Add a certification you have earned"
      onAdd={onAdd}
    >
      {items.length > 0 ? (
        <Collapsible
          items={items}
          noun="certifications"
          render={(c, i) => (
            <div key={i} className="flex gap-3 border-b border-[#edeff1] py-3 first:pt-0 last:border-0 last:pb-0">
              <OrgBadge name={c.issuer || c.name} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1c1c1c]">{c.name}</p>
                <p className="text-xs text-[#878a8c]">
                  {[c.issuer, c.year].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}
        />
      ) : undefined}
    </Section>
  )
}

export function AchievementsSection({
  user,
  isMe,
  onAdd,
}: {
  user: User
  isMe: boolean
  onAdd: () => void
}) {
  const items = user.achievements ?? []
  return (
    <Section
      icon={<Award size={17} />}
      title="Achievements"
      count={items.length}
      isMe={isMe}
      emptyPrompt="Add an award or achievement"
      onAdd={onAdd}
    >
      {items.length > 0 ? (
        <Collapsible
          items={items}
          noun="achievements"
          render={(a, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="text-sm text-[#1c1c1c]">{a.title}</span>
              {a.year && <span className="shrink-0 text-xs text-[#878a8c]">{a.year}</span>}
            </div>
          )}
        />
      ) : undefined}
    </Section>
  )
}

/** The mentorship offer — only meaningful for a verified mentor. */
export function MentorshipSection({ user, onBook }: { user: User; onBook?: () => void }) {
  if (!user.isMentor || !user.mentorVerified) return null
  const topics = user.mentorTopics ?? []
  return (
    <Card className="border-[#ff4500]/20 bg-orange-50/40 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
          <Users size={17} className="text-[#ff4500]" />
          Mentorship
        </h2>
        <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-green-700">
          <BadgeCheck size={12} /> Verified
        </span>
      </div>
      {topics.length > 0 && (
        <div className="mt-3">
          <Chips items={topics} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#878a8c]">
        {user.mentorAvailability && <span>🕑 {user.mentorAvailability}</span>}
        {user.mentorshipMode && <span>💬 {user.mentorshipMode}</span>}
        {!!user.sessionsConducted && <span>{user.sessionsConducted} sessions held</span>}
        <span className="font-semibold text-[#1c1c1c]">
          {user.mentorRate ? `₹${user.mentorRate}/hr` : 'Rate on request'}
        </span>
      </div>
      {onBook && (
        <button
          onClick={onBook}
          className="mt-3 rounded-full bg-[#ff4500] px-4 py-2 text-xs font-bold text-white hover:bg-[#ff6534]"
        >
          Book a session
        </button>
      )}
    </Card>
  )
}

/** What this member is open to — the row that makes a profile actionable. */
export function OpenToSection({ user }: { user: User }) {
  const rows: { icon: ReactNode; text: string }[] = []

  if (user.openToReferrals) {
    rows.push({
      icon: <Handshake size={14} />,
      text: user.referralNote || 'Willing to give referrals at their company',
    })
  }
  if ((user.hiringFor ?? []).length > 0) {
    rows.push({ icon: <Briefcase size={14} />, text: `Hiring for ${user.hiringFor!.join(', ')}` })
  }
  if (user.interestedInStartup && user.startupIntent) {
    const looking = (user.startupLookingFor ?? []).join(', ')
    rows.push({
      icon: <Rocket size={14} />,
      text: `StartupVarsity — ${user.startupIntent}${looking ? `, looking for ${looking}` : ''}`,
    })
  }
  if (user.workMode || user.openToRelocate) {
    rows.push({
      icon: <MapPin size={14} />,
      text: [
        user.workMode && `Prefers ${user.workMode.toLowerCase()}`,
        user.openToRelocate && 'open to relocating',
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }
  if (user.openToSpeakAtEvents) {
    rows.push({ icon: <Sparkles size={14} />, text: 'Happy to speak at alumni events' })
  }
  if (rows.length === 0) return null

  return (
    <Section icon={<Handshake size={17} />} title="Open to">
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#1c1c1c]">
            <span className="mt-0.5 shrink-0 text-[#878a8c]">{r.icon}</span>
            {r.text}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Contact + links + languages + interests + industry — the About tab. */
export function DetailsSection({ user }: { user: User }) {
  const links = [
    user.linkedin && { label: 'LinkedIn', url: user.linkedin, icon: <LinkIcon size={13} /> },
    user.github && { label: 'GitHub', url: user.github, icon: <Code2 size={13} /> },
    user.portfolio && { label: 'Portfolio', url: user.portfolio, icon: <Globe size={13} /> },
    ...(user.otherLinks ?? []).map((l) => ({
      label: l.label || l.url,
      url: l.url,
      icon: <LinkIcon size={13} />,
    })),
  ].filter(Boolean) as { label: string; url: string; icon: ReactNode }[]

  const langs = user.languagesKnown ?? []
  const interests = user.interests ?? []
  // These arrive empty unless the member opened that field's lock, so simply
  // rendering whatever is present is already correct.
  const contact = [
    user.email && { icon: <Mail size={13} />, value: user.email },
    user.phone && { icon: <Phone size={13} />, value: user.phone },
    user.homeAddress && { icon: <Home size={13} />, value: user.homeAddress },
    user.age !== undefined && { icon: <Cake size={13} />, value: `${user.age} years old` },
    (user.salaryCurrent || user.salaryExpected) && {
      icon: <Wallet size={13} />,
      value: [
        user.salaryCurrent && `Currently ₹${user.salaryCurrent.toLocaleString('en-IN')}/yr`,
        user.salaryExpected && `expecting ₹${user.salaryExpected.toLocaleString('en-IN')}/yr`,
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ].filter(Boolean) as { icon: ReactNode; value: string }[]

  if (
    links.length === 0 &&
    langs.length === 0 &&
    interests.length === 0 &&
    contact.length === 0 &&
    !user.industry &&
    !user.roomanCenter
  ) {
    return null
  }

  return (
    <Section icon={<LinkIcon size={17} />} title="Details">
      <div className="flex flex-col gap-4">
        {contact.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {contact.map((c, i) => (
              <p key={i} className="flex items-center gap-2 text-sm text-[#1c1c1c]">
                <span className="text-[#878a8c]">{c.icon}</span>
                {c.value}
              </p>
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-[#edeff1] px-3 py-1.5 text-xs font-medium text-[#1c1c1c] hover:border-[#ff4500] hover:text-[#ff4500]"
              >
                {l.icon}
                {l.label}
              </a>
            ))}
          </div>
        )}

        {(user.industry || user.roomanCenter) && (
          <dl className="flex flex-col gap-1 text-xs">
            {user.industry && (
              <div className="flex gap-2">
                <dt className="text-[#878a8c]">Industry</dt>
                <dd className="font-medium text-[#1c1c1c]">{user.industry}</dd>
              </div>
            )}
            {user.roomanCenter && (
              <div className="flex gap-2">
                <dt className="text-[#878a8c]">Rooman centre</dt>
                <dd className="font-medium text-[#1c1c1c]">{user.roomanCenter}</dd>
              </div>
            )}
          </dl>
        )}

        {langs.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#878a8c]">
              <Languages size={12} /> Languages
            </p>
            <Chips items={langs} />
          </div>
        )}

        {interests.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#878a8c]">Interests</p>
            <Chips items={interests} />
          </div>
        )}
      </div>
    </Section>
  )
}

/**
 * The private block, rendered only for the owner — these fields aren't merely
 * hidden here, the API withholds them from everyone else (see mapOwnUser).
 */
export function PrivateSection({ user }: { user: User }) {
  const rows = [
    !user.showPhone && user.phone && { label: 'Phone', value: user.phone },
    !user.showEmail && user.email && { label: 'Email', value: user.email },
    !user.showAddress && user.homeAddress && { label: 'Address', value: user.homeAddress },
    !user.showAge &&
      user.age !== undefined && { label: 'Age', value: `${user.age} (born ${user.dateOfBirth})` },
    !user.showSalary &&
      (user.salaryCurrent || user.salaryExpected) && {
        label: 'Salary',
        value: [
          user.salaryCurrent && `₹${user.salaryCurrent.toLocaleString('en-IN')} now`,
          user.salaryExpected && `₹${user.salaryExpected.toLocaleString('en-IN')} expected`,
        ]
          .filter(Boolean)
          .join(' · '),
      },
    user.noticePeriod && { label: 'Notice period', value: user.noticePeriod },
    (user.preferredLocations ?? []).length > 0 && {
      label: 'Preferred locations',
      value: user.preferredLocations!.join(', '),
    },
    (user.seekingMentorshipIn ?? []).length > 0 && {
      label: 'Wants mentorship in',
      value: user.seekingMentorshipIn!.join(', '),
    },
  ].filter(Boolean) as { label: string; value: string }[]

  if (rows.length === 0) return null
  return (
    <Card className="border-dashed p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#1c1c1c]">
        <Lock size={15} className="text-[#878a8c]" />
        Only you can see this
      </h2>
      <p className="mt-0.5 text-xs text-[#878a8c]">
        Used to match you with jobs and mentors. Turn contact details on from Edit Profile if you
        want them public.
      </p>
      <dl className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap gap-x-2 text-sm">
            <dt className="text-[#878a8c]">{r.label}:</dt>
            <dd className="font-medium text-[#1c1c1c]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
