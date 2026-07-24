import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, Check } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { api } from '../lib/api'
import { fileToPhotoDataUrl } from '../lib/image'
import { Avatar } from '../components/ui'
import { ResumeUpload } from '../components/onboarding/ResumeUpload'
import {
  DOMAINS,
  EMPLOYMENT_TYPES,
  WORKING_EMPLOYMENT_TYPES,
  statusOf,
  type CurrentStatus,
  type Domain,
  type EmploymentType,
} from '../types'

const STATUS_OPTIONS: CurrentStatus[] = [
  'Working Professional',
  'Student',
  'Looking for opportunity',
  'Just looking around',
]

const STEPS = ['Import Resume', 'Basic Info', 'Current Status', 'Profile Setup', 'Interests']

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
  const { updateProfile, notify, currentUser } = useApp()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(0)
  const [photo, setPhoto] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)

  const [form, setForm] = useState({
    // Prefilled from the account created at signup. Email is the login
    // identity and can't be changed here.
    name: currentUser.name === 'You' ? '' : currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone ?? '',
    batchYear: '',
    course: '',
    company: '',
    designation: '',
    college: '',
    experienceYears: '',
    domain: '' as Domain | '',
    employmentType: '' as EmploymentType | '',
    linkedin: '',
    bio: '',
    city: '',
    willingToMentor: false,
    interestedInStartup: false,
    expertise: '',
  })

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const status = statusOf(form.employmentType)

  // Switching Current Status clears whatever fields no longer apply, so a
  // stale company/designation/college doesn't ride along unfilled on save.
  function pickStatus(s: CurrentStatus) {
    setForm((f) => ({
      ...f,
      employmentType:
        s === 'Working Professional' ? (statusOf(f.employmentType) === 'Working Professional' ? f.employmentType : 'Employed') : s,
      company: s === 'Working Professional' ? f.company : '',
      designation: s === 'Working Professional' ? f.designation : '',
      college: s === 'Student' ? f.college : '',
      experienceYears: s === 'Working Professional' || s === 'Looking for opportunity' ? f.experienceYears : '',
    }))
  }

  // Real AI resume parsing (Claude via the backend). Prefills every step of the
  // form from the extracted details; the user's own input always wins over a
  // field the resume didn't contain.
  async function parseResume(file: File) {
    setParsing(true)
    try {
      const dataBase64 = await toBase64(file)
      // Some platforms leave file.type empty — infer from the extension.
      const mediaType =
        file.type ||
        (/\.docx$/i.test(file.name)
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf')
      // Minimum ~600ms so the parsing animation doesn't flash; Claude usually takes longer.
      const [result] = await Promise.all([api.parseResume(dataBase64, mediaType), wait(600)])

      const top = result.experience[0]
      const pick = (parsed: string | undefined, current: string) => parsed || current
      setForm((f) => ({
        ...f,
        name: pick(result.name, f.name),
        phone: pick(result.phone, f.phone),
        batchYear: pick(result.batchYear?.replace(/\D/g, '').slice(0, 4), f.batchYear),
        course: pick(result.course, f.course),
        company: pick(top?.company, f.company),
        designation: top?.role || f.designation || result.headline,
        college: pick(result.college, f.college),
        experienceYears: pick(result.experienceYears?.replace(/\D/g, '').slice(0, 2), f.experienceYears),
        domain: DOMAINS.includes(result.domain as Domain) ? (result.domain as Domain) : f.domain,
        employmentType: EMPLOYMENT_TYPES.includes(result.employmentType as EmploymentType)
          ? (result.employmentType as EmploymentType)
          : f.employmentType,
        linkedin: pick(result.linkedin, f.linkedin),
        city: pick(result.city, f.city),
        bio: pick(result.bio || result.headline, f.bio),
        expertise: result.skills.length ? result.skills.join(', ') : f.expertise,
      }))

      if (result.source === 'fallback') {
        notify('AI parsing is not configured on the server — sample data filled in for demo.', 'info')
      } else {
        notify('Resume parsed — your details are filled in. Review each step and finish.', 'success')
      }
      // Jump straight into reviewing the prefilled details.
      setStep(1)
    } catch (err) {
      notify(
        err instanceof Error && err.message && !err.message.startsWith('Request failed')
          ? err.message
          : 'Could not parse resume. Is the backend running? You can fill it in manually.',
        'error',
      )
    } finally {
      setParsing(false)
    }
  }

  const canNext = () => {
    if (step === 0) return true // resume import is optional
    if (step === 1) return form.name && form.email && form.batchYear && form.course
    if (step === 2) return true // current status is optional — fill in what applies, skip the rest
    if (step === 3) return form.city
    return true
  }

  async function finish() {
    setSaving(true)
    try {
      await updateProfile({
        name: form.name || 'You',
        ...(photo ? { photo } : {}),
        phone: form.phone,
        batchYear: Number(form.batchYear) || new Date().getFullYear(),
        course: form.course,
        company: form.company,
        designation: form.designation,
        college: form.college,
        experienceYears: Number(form.experienceYears) || 0,
        domain: (form.domain || 'Web Dev') as Domain,
        // A truly skipped step 2 means "didn't say" — default to the honest
        // catch-all, not a guessed 'Employed'.
        employmentType: (form.employmentType || 'Just looking around') as EmploymentType,
        linkedin: form.linkedin,
        bio: form.bio || 'Rooman alumnus.',
        city: form.city,
        willingToMentor: form.willingToMentor,
        interestedInStartup: form.interestedInStartup,
        isMentor: form.willingToMentor,
        ...(form.willingToMentor ? { sessionsConducted: 0 } : {}),
        expertise: form.expertise
          ? form.expertise.split(',').map((s) => s.trim()).filter(Boolean)
          : ['Rooman Alumni'],
      })
      notify('Welcome to the Rooman Alumni Network! 🎉')
      navigate('/home')
    } catch {
      notify('Could not save your profile. Please try again.', 'error')
      setSaving(false)
    }
  }

  const next = () => (step < STEPS.length - 1 ? setStep((s) => s + 1) : finish())

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-[#edeff1] bg-white p-6 shadow-sm sm:p-8">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-[#ff4500]' : 'bg-[#edeff1]'}`} />
              <span className={`text-[11px] font-medium ${i === step ? 'text-[#ff4500]' : 'text-[#878a8c]'}`}>
                {s}
              </span>
            </div>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-[#1c1c1c]">{STEPS[step]}</h1>
        <p className="mb-5 text-sm text-[#878a8c]">Step {step + 1} of {STEPS.length}</p>

        {/* Step content */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
              <p className="font-semibold text-[#1c1c1c]">
                Welcome{form.name ? `, ${form.name.split(' ')[0]}` : ''}! 👋
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#1c1c1c]/70">
                Drop your resume and AI fills in your whole profile — batch, course, company,
                skills, everything. You review each step before it's saved. No resume handy?
                Skip and fill it in manually.
              </p>
            </div>
            <ResumeUpload parsing={parsing} onParse={parseResume} />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <Field label="Full Name" value={form.name} onChange={(v) => set('name', v)} placeholder="Aarav Sharma" />
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">Email</label>
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-[#edeff1] bg-[#f6f7f8] px-3 py-2 text-sm text-[#878a8c]"
              />
              <p className="mt-1 text-xs text-[#878a8c]">This is your sign-in email (set at signup).</p>
            </div>
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+91 …" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batch Year" value={form.batchYear} onChange={(v) => set('batchYear', v.replace(/\D/g, '').slice(0, 4))} placeholder="2019" />
              <Field label="Course at Rooman" value={form.course} onChange={(v) => set('course', v)} placeholder="Full-Stack Dev" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">Current Status</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickStatus(s)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      status === s
                        ? 'border-[#ff4500] bg-orange-50 text-[#ff4500]'
                        : 'border-[#edeff1] text-[#1c1c1c] hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[#878a8c]">Optional — pick what applies, or skip this step entirely.</p>
            </div>

            {status === 'Working Professional' && (
              <>
                <Select
                  label="Employment Type"
                  value={form.employmentType}
                  onChange={(v) => set('employmentType', v)}
                  options={WORKING_EMPLOYMENT_TYPES}
                />
                <Field label="Current Company" value={form.company} onChange={(v) => set('company', v)} placeholder="Amazon" />
                <Field label="Designation" value={form.designation} onChange={(v) => set('designation', v)} placeholder="Software Engineer" />
                <Field label="Years of Experience" value={form.experienceYears} onChange={(v) => set('experienceYears', v.replace(/\D/g, '').slice(0, 2))} placeholder="4" />
              </>
            )}

            {status === 'Student' && (
              <Field label="College / Institution" value={form.college} onChange={(v) => set('college', v)} placeholder="Rooman Technologies" />
            )}

            {status === 'Looking for opportunity' && (
              <Field label="Years of Experience" value={form.experienceYears} onChange={(v) => set('experienceYears', v.replace(/\D/g, '').slice(0, 2))} placeholder="4" />
            )}

            <Select label="Expertise Domain" value={form.domain} onChange={(v) => set('domain', v)} options={DOMAINS} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#edeff1] bg-[#f6f7f8]"
              >
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : form.name ? (
                  <Avatar name={form.name} size={76} />
                ) : (
                  <Camera size={24} className="text-[#878a8c]" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    setPhoto(await fileToPhotoDataUrl(f))
                  } catch {
                    notify('Could not read that image — try a different file.', 'error')
                  }
                }}
              />
              <div>
                <p className="text-sm font-semibold text-[#1c1c1c]">Profile Photo</p>
                <p className="text-xs text-[#878a8c]">Click the circle to upload (optional)</p>
              </div>
            </div>
            <Field label="LinkedIn URL" value={form.linkedin} onChange={(v) => set('linkedin', v)} placeholder="https://linkedin.com/in/…" />
            <Field label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="Bengaluru" />
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">Short Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                rows={3}
                placeholder="Tell the network about yourself…"
                className="w-full resize-none rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
              />
            </div>
            <Field label="Key Skills (comma separated)" value={form.expertise} onChange={(v) => set('expertise', v)} placeholder="React, AWS, Node.js" />
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <Toggle
              label="Willing to mentor juniors?"
              hint="Get listed as a mentor and conduct paid sessions."
              value={form.willingToMentor}
              onChange={(v) => set('willingToMentor', v)}
            />
            <Toggle
              label="Interested in StartupVarsity?"
              hint="Access labs, mentors and seed support to build your product."
              value={form.interestedInStartup}
              onChange={(v) => set('interestedInStartup', v)}
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? navigate('/') : setStep((s) => s - 1))}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#878a8c] hover:text-[#1c1c1c]"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={next}
            disabled={!canNext() || saving || (step === 0 && parsing)}
            className="flex items-center gap-2 rounded-full bg-[#ff4500] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#ff6534] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === STEPS.length - 1 ? (
              <>{saving ? 'Saving…' : 'Finish'} <Check size={16} /></>
            ) : step === 0 ? (
              <>Skip — fill manually <ArrowRight size={16} /></>
            ) : (
              <>Continue <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]"
      />
    </div>
  )
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: T) => void
  options: readonly T[]
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#1c1c1c]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm text-[#1c1c1c] outline-none focus:border-[#ff4500]"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${
        value ? 'border-[#ff4500] bg-orange-50' : 'border-[#edeff1] hover:bg-gray-50'
      }`}
    >
      <div>
        <p className="font-semibold text-[#1c1c1c]">{label}</p>
        <p className="text-xs text-[#878a8c]">{hint}</p>
      </div>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? 'bg-[#ff4500]' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
