'use client'

import { useState, type FormEvent } from 'react'
import { updateCurrentUser, type CurrentUser } from '../../lib/api'
import { friendlyError, normalizeNigerianPhone } from '../../lib/format'
import { isServiceNotLive } from '../service-unavailable'

const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'
const labelClass = 'grid gap-1.5 text-xs font-semibold text-slate-700'

type EditProfileFormProps = {
  user?: CurrentUser | null
  onSaved: (user: CurrentUser) => void
  onCancel: () => void
}

export function EditProfileForm({ user, onSaved, onCancel }: EditProfileFormProps) {
  const [fullName, setFullName] = useState(user?.passengerProfile?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = fullName.trim()
    if (name.length < 2) return setError('Enter your full name.')
    const normalizedPhone = phone.trim() ? normalizeNigerianPhone(phone) : undefined
    if (phone.trim() && !normalizedPhone) return setError('Use a Nigerian number like 0801 234 5678.')

    setSaving(true)
    setError('')
    try {
      const updated = await updateCurrentUser({
        fullName: name,
        email: email.trim() || undefined,
        phone: normalizedPhone ?? undefined,
      })
      onSaved({
        ...user,
        ...updated,
        passengerProfile: { ...user?.passengerProfile, ...updated?.passengerProfile, fullName: updated?.passengerProfile?.fullName ?? name },
      })
    } catch (saveError) {
      setError(isServiceNotLive(saveError) ? 'Profile editing isn’t live on the NexaGo server yet. Your details are unchanged.' : friendlyError(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
      <label className={labelClass}>Full name<input required autoFocus autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Amina Bello" className={fieldClass} /></label>
      <label className={labelClass}>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className={fieldClass} /></label>
      <label className={labelClass}>Phone number<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0801 234 5678" className={fieldClass} /></label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={saving} className="h-11 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  )
}
