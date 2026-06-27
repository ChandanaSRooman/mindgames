import { Briefcase, GraduationCap, Image as ImageIcon, Search } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { useLayout } from '../layout/LayoutContext'
import { Avatar, Card } from '../ui'

export function CreatePostBox() {
  const { currentUser } = useApp()
  const { openComposer } = useLayout()

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <Avatar name={currentUser.name} size={44} />
        <button
          onClick={() => openComposer()}
          className="flex-1 rounded-full border border-[#edeff1] bg-[#f6f7f8] px-4 py-2.5 text-left text-sm text-[#878a8c] hover:border-[#ff4500]"
        >
          Share an update, achievement or opportunity…
        </button>
      </div>
      <div className="mt-2 flex items-center justify-around border-t border-[#edeff1] pt-2">
        <Quick icon={<ImageIcon size={18} className="text-emerald-500" />} label="Photo" onClick={() => openComposer()} />
        <Quick icon={<Briefcase size={18} className="text-green-600" />} label="Hiring" onClick={() => openComposer({ type: 'Hiring' })} />
        <Quick icon={<Search size={18} className="text-blue-600" />} label="Open to Work" onClick={() => openComposer({ type: 'Open to Work' })} />
        <Quick icon={<GraduationCap size={18} className="text-[#ff4500]" />} label="Mentorship" onClick={() => openComposer({ type: 'Mentorship' })} />
      </div>
    </Card>
  )
}

function Quick({
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
      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[#878a8c] hover:bg-gray-100"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
