import { FileText, FolderGit2, GraduationCap, Link2, Newspaper, CirclePlay } from 'lucide-react'

const ICONS = {
  course: GraduationCap,
  tutorial: CirclePlay,
  doc: FileText,
  project: FolderGit2,
  article: Newspaper,
} as const

// Each kind gets its own tint, so a row of cards is scannable at a glance.
const TINTS: Record<string, string> = {
  course: 'bg-amber-50 text-amber-600',
  tutorial: 'bg-rose-50 text-rose-600',
  doc: 'bg-sky-50 text-sky-600',
  project: 'bg-emerald-50 text-emerald-600',
  article: 'bg-violet-50 text-violet-600',
  // Older saved rows can carry career_resources kinds this page never shares.
  link: 'bg-indigo-50 text-indigo-600',
}

/** The square icon tile at the top-left of a resource or project card. */
export function KindIcon({ kind, size = 40 }: { kind: string; size?: number }) {
  const Icon = ICONS[kind as keyof typeof ICONS] ?? Link2
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${TINTS[kind] ?? TINTS.link}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  )
}

/** The small coloured badge at the card's top-right ("Documentation"). */
export function KindBadge({ label, kind }: { label: string; kind: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TINTS[kind] ?? TINTS.link}`}>
      {label}
    </span>
  )
}
