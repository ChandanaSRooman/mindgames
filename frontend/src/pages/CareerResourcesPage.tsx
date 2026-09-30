import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { LearningResourcesPanel } from '../components/career/LearningResourcesPanel'

/**
 * Learning resources, a top-level screen at /learning-resources.
 *
 * Top level rather than under /career-guidance because it is its own sidebar
 * tab, sitting directly above Career Guidance. Nesting it would have made
 * React Router mark BOTH sidebar entries active at once — NavLink treats a
 * parent path as active for its children — so the path mirrors the nav.
 *
 * Still reachable from the Career Guidance header too, since resources are
 * usually filed against a roadmap stage.
 */
export function CareerResourcesPage() {
  const navigate = useNavigate()

  // Popped rather than replaced, so the browser's Back button doesn't appear
  // to do nothing — the same handler as ManageServicesPage, for the same
  // reason documented there.
  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/career-guidance', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-start gap-2">
        <button
          onClick={back}
          className="mt-1 rounded-full p-1 text-[#878a8c] hover:bg-gray-100"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#ff4500]">
          <BookOpen size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-[#1c1c1c]">Learning resources</h1>
          <p className="text-sm text-[#878a8c]">
            What you are learning from, kept next to the plan it serves.
          </p>
        </div>
      </div>

      <LearningResourcesPanel />
    </div>
  )
}
