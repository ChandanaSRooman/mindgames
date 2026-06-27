import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Sparkles } from 'lucide-react'
import type { Experience, StatusTag } from '../types'
import { STATUS_TAGS } from '../types'
import { api } from '../lib/api'
import { useApp } from '../store/AppStore'
import { Button, Card } from '../components/ui'
import { StatusToggle } from '../components/ui/StatusBadge'
import { ResumeUpload } from '../components/onboarding/ResumeUpload'
import { ExperienceTimeline } from '../components/onboarding/ExperienceTimeline'
import { SkillsPills } from '../components/onboarding/SkillsPills'

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Read a File as a base64 string (without the data: URL prefix).
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function Onboarding() {
  const navigate = useNavigate()
  const { notify, saveOnboarding } = useApp()
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(false)
  const [headline, setHeadline] = useState('')
  const [experience, setExperience] = useState<Experience[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [tags, setTags] = useState<StatusTag[]>([])

  async function parse(file: File) {
    setParsing(true)
    try {
      const dataBase64 = await toBase64(file)
      // Minimum ~600ms so the parsing animation doesn't flash; Claude usually takes longer.
      const [result] = await Promise.all([api.parseResume(dataBase64, file.type), wait(600)])
      setHeadline(result.headline)
      setExperience(result.experience)
      setSkills(result.skills)
      setParsed(true)
      notify('Resume parsed — review and edit your profile below.', 'success')
    } catch {
      notify('Could not parse resume. Is the backend running?', 'error')
    } finally {
      setParsing(false)
    }
  }

  function toggleTag(t: StatusTag) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function finish() {
    saveOnboarding({ headline, experience, skills, tags })
    notify('Profile saved to this device.', 'success')
    navigate('/feed')
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="border-b border-navy-800 bg-navy-900/60">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5 px-6 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 text-navy-950">
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Set up your profile</p>
            <p className="text-xs text-slate-400">Step {parsed ? 2 : 1} of 2</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-teal-300" />
            <h2 className="text-base font-semibold text-white">Import from resume</h2>
          </div>
          <p className="mb-4 text-sm text-slate-400">
            Upload your resume and let AI pre-fill your experience and skills. You can edit everything afterward.
          </p>
          <ResumeUpload parsing={parsing} onParse={parse} />
        </Card>

        {parsing && (
          <Card className="flex items-center gap-3 p-6">
            <Sparkles size={18} className="animate-pulse text-teal-300" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">AI is parsing your resume…</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-700">
                <div className="h-full w-1/3 animate-[progress_1.4s_ease-in-out_infinite] rounded-full bg-teal-500" />
              </div>
            </div>
          </Card>
        )}

        {parsed && (
          <>
            {headline && (
              <p className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-200">
                Detected headline: <span className="font-semibold">{headline}</span>
              </p>
            )}

            <Card className="p-6">
              <h2 className="mb-4 text-base font-semibold text-white">Experience</h2>
              <ExperienceTimeline items={experience} />
            </Card>

            <Card className="p-6">
              <h2 className="mb-1 text-base font-semibold text-white">Skills</h2>
              <p className="mb-4 text-sm text-slate-400">Tap × to remove, or add your own.</p>
              <SkillsPills skills={skills} onChange={setSkills} />
            </Card>

            <Card className="p-6">
              <h2 className="mb-1 text-base font-semibold text-white">Your status</h2>
              <p className="mb-4 text-sm text-slate-400">
                Pick all that apply — these power mentor/talent matching in the feed.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {STATUS_TAGS.map((t) => (
                  <StatusToggle key={t} tag={t} active={tags.includes(t)} onToggle={() => toggleTag(t)} />
                ))}
              </div>
            </Card>

            <div className="flex justify-end">
              <Button icon={<ArrowRight size={16} />} onClick={finish}>
                Go to Network Feed
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
