import { useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { fileToPhotoDataUrl } from '../../lib/image'
import { Button } from '../ui'
import { ProfilePhoto } from './ProfilePhoto'
import {
  DOMAINS,
  WORKING_EMPLOYMENT_TYPES,
  statusOf,
  type CurrentStatus,
  type Domain,
  type EmploymentType,
} from '../../types'

const STATUS_OPTIONS: CurrentStatus[] = [
  'Working Professional',
  'Student',
  'Looking for opportunity',
  'Just looking around',
]

// Edit the signed-in user's profile. Saves via PATCH /api/users/me (RDS).
export function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { currentUser, updateProfile, notify } = useApp()
  const [saving, setSaving] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  // undefined = unchanged; string = new photo; null = remove existing photo.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined)
  const shownPhoto = photo === undefined ? currentUser.photo : photo

  const [form, setForm] = useState({
    name: currentUser.name,
    designation: currentUser.designation,
    company: currentUser.company,
    college: currentUser.college ?? '',
    city: currentUser.city,
    phone: currentUser.phone ?? '',
    linkedin: currentUser.linkedin ?? '',
    bio: currentUser.bio,
    course: currentUser.course,
    batchYear: String(currentUser.batchYear || ''),
    experienceYears: String(currentUser.experienceYears || 0),
    domain: currentUser.domain as Domain,
    employmentType: currentUser.employmentType as EmploymentType,
    expertise: currentUser.expertise.join(', '),
    willingToMentor: currentUser.willingToMentor,
    interestedInStartup: currentUser.interestedInStartup,
    mentorRate: currentUser.mentorRate ? String(currentUser.mentorRate) : '',
  })

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const status = statusOf(form.employmentType)

  async function save() {
    if (!form.name.trim()) return notify('Name is required.', 'error')
    setSaving(true)
    try {
      await updateProfile({
        name: form.name.trim(),
        ...(photo !== undefined ? { photo } : {}),
        designation: form.designation,
        company: form.company,
        college: form.college,
        city: form.city,
        phone: form.phone,
        linkedin: form.linkedin,
        bio: form.bio,
        course: form.course,
        batchYear: Number(form.batchYear) || currentUser.batchYear,
        experienceYears: Number(form.experienceYears) || 0,
        domain: form.domain,
        employmentType: form.employmentType,
        expertise: form.expertise.split(',').map((s) => s.trim()).filter(Boolean),
        willingToMentor: form.willingToMentor,
        interestedInStartup: form.interestedInStartup,
        isMentor: form.willingToMentor,
        ...(form.willingToMentor && form.mentorRate
          ? { mentorRate: Number(form.mentorRate) }
          : {}),
      })
      notify('Profile updated.')
      onClose()
    } catch {
      notify('Could not save your profile.', 'error')
      setSaving(false)
    }
  }

  const field =
    'w-full rounded-lg border border-[#edeff1] px-3 py-2 text-sm outline-none focus:border-[#ff4500]'
  const label = 'mb-1 block text-sm font-medium text-[#1c1c1c]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1c1c1c]">Edit Profile</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100">
            <X size={18} className="text-[#878a8c]" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Profile photo */}
          <div className="flex items-center gap-4">
            <ProfilePhoto
              name={form.name || currentUser.name}
              photo={shownPhoto}
              size={64}
              canEdit
              onChange={(p) => setPhoto(p)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="!px-3 !py-1.5 text-xs"
                onClick={() => photoRef.current?.click()}
              >
                <Camera size={14} /> {shownPhoto ? 'Change photo' : 'Upload photo'}
              </Button>
              {shownPhoto && (
                <Button
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs !text-red-500 hover:!bg-red-50"
                  onClick={() => setPhoto(null)}
                >
                  <Trash2 size={14} /> Remove
                </Button>
              )}
              <input
                ref={photoRef}
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
            </div>
          </div>

          <div>
            <label className={label}>Full Name</label>
            <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div>
            <label className={label}>Current Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    set('employmentType', s === 'Working Professional' ? (status === 'Working Professional' ? form.employmentType : 'Employed') : s)
                  }
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
          </div>

          {status === 'Working Professional' && (
            <>
              <div>
                <label className={label}>Employment Type</label>
                <select className={field} value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                  {WORKING_EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Designation</label>
                  <input className={field} value={form.designation} onChange={(e) => set('designation', e.target.value)} />
                </div>
                <div>
                  <label className={label}>Company</label>
                  <input className={field} value={form.company} onChange={(e) => set('company', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {status === 'Student' && (
            <div>
              <label className={label}>College / Institution</label>
              <input className={field} value={form.college} onChange={(e) => set('college', e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>City</label>
              <input className={field} value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input className={field} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Batch Year</label>
              <input className={field} value={form.batchYear} onChange={(e) => set('batchYear', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
            {(status === 'Working Professional' || status === 'Looking for opportunity') && (
              <div>
                <label className={label}>Experience (yrs)</label>
                <input className={field} value={form.experienceYears} onChange={(e) => set('experienceYears', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </div>
            )}
          </div>
          <div>
            <label className={label}>Course at Rooman</label>
            <input className={field} value={form.course} onChange={(e) => set('course', e.target.value)} />
          </div>
          <div>
            <label className={label}>Domain</label>
            <select className={field} value={form.domain} onChange={(e) => set('domain', e.target.value)}>
              {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>LinkedIn URL</label>
            <input className={field} value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} />
          </div>
          <div>
            <label className={label}>Bio</label>
            <textarea className={`${field} resize-none`} rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
          </div>
          <div>
            <label className={label}>Skills (comma separated)</label>
            <input className={field} value={form.expertise} onChange={(e) => set('expertise', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#1c1c1c]">
            <input type="checkbox" className="h-4 w-4 accent-[#ff4500]" checked={form.willingToMentor} onChange={(e) => set('willingToMentor', e.target.checked)} />
            Willing to mentor juniors
          </label>
          {form.willingToMentor && (
            <div className="ml-6">
              <label className={label}>Mentorship rate (₹ / hour)</label>
              <input
                className={field}
                inputMode="numeric"
                placeholder="e.g. 1000"
                value={form.mentorRate}
                onChange={(e) => set('mentorRate', e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <p className="mt-1 text-xs text-[#878a8c]">Shown on your mentor card. Leave empty for "Rate on request".</p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-[#1c1c1c]">
            <input type="checkbox" className="h-4 w-4 accent-[#ff4500]" checked={form.interestedInStartup} onChange={(e) => set('interestedInStartup', e.target.checked)} />
            Interested in StartupVarsity
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </div>
  )
}
