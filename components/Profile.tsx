'use client'

import { BadgeCheck, Car, LifeBuoy, LogOut, Mail, Pencil, Phone, ShieldAlert, Siren, UserRound, Wallet } from 'lucide-react'
import { useState } from 'react'
import type { CurrentUser } from '../lib/api'
import { EditProfileForm } from './profile/edit-profile-form'
import { SavedPlacesList } from './profile/saved-places-list'
import { TrustedContacts } from './profile/trusted-contacts'

type ProfileProps = {
  signedIn: boolean
  user?: CurrentUser | null
  loading?: boolean
  onSignIn: () => void
  onLogout: () => void
  onOpenWallet: () => void
  onOpenSafety: () => void
  onOpenDriver: () => void
  onUserUpdated: (user: CurrentUser) => void
}

function formatMemberSince(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return null
  return new Intl.DateTimeFormat('en-NG', { month: 'long', year: 'numeric' }).format(new Date(value))
}

export default function Profile({ signedIn, user, loading, onSignIn, onLogout, onOpenWallet, onOpenSafety, onOpenDriver, onUserUpdated }: ProfileProps) {
  const [editing, setEditing] = useState(false)
  if (!signedIn) {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-teal-50 text-teal-800"><UserRound size={24} aria-hidden="true" /></span>
        <h3 className="mt-4 text-lg font-bold text-slate-900">You&apos;re not signed in</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-slate-500">Sign in to book rides, use your NexaPay wallet, and keep track of your trips.</p>
        <button type="button" onClick={onSignIn} className="mt-5 h-12 w-full rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900">Sign in or create account</button>
      </div>
    )
  }

  if (loading && !user) {
    return <div role="status" className="grid min-h-48 place-items-center"><span className="size-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" /><span className="sr-only">Loading profile</span></div>
  }

  if (editing && user) {
    return <EditProfileForm user={user} onCancel={() => setEditing(false)} onSaved={(updated) => { onUserUpdated(updated); setEditing(false) }} />
  }

  const fullName = user?.passengerProfile?.fullName?.trim() || user?.email?.split('@')[0] || 'NexaGo rider'
  const verified = user?.passengerProfile?.verificationStatus === 'VERIFIED'
  const memberSince = formatMemberSince(user?.createdAt)

  return (
    <div className="grid gap-4 py-2">
      <section className="rounded-3xl bg-gradient-to-br from-[#123d42] to-[#17696a] p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-white/20 bg-white/10 text-xl font-bold">{fullName.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold capitalize">{fullName}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-teal-100">
              {verified ? <><BadgeCheck size={14} aria-hidden="true" /> Verified rider</> : <><ShieldAlert size={14} aria-hidden="true" /> Identity not yet verified</>}
            </p>
            {memberSince && <p className="mt-1 text-[11px] text-teal-100/70">Member since {memberSince}</p>}
          </div>
          {user && <button type="button" onClick={() => setEditing(true)} aria-label="Edit profile" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><Pencil size={15} /></button>}
        </div>
      </section>

      <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 p-3.5"><Mail size={16} className="shrink-0 text-teal-700" aria-hidden="true" /><dt className="sr-only">Email</dt><dd className="min-w-0 truncate text-sm text-slate-800">{user?.email || 'No email on file'}</dd></div>
        <div className="flex items-center gap-3 p-3.5"><Phone size={16} className="shrink-0 text-teal-700" aria-hidden="true" /><dt className="sr-only">Phone</dt><dd className="text-sm text-slate-800">{user?.phone || 'No phone number on file'}</dd></div>
      </dl>

      <SavedPlacesList />
      <TrustedContacts />

      <div className="grid gap-2">
        <button type="button" onClick={onOpenSafety} className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5 text-left text-sm font-semibold text-rose-800 transition hover:bg-rose-50"><Siren size={17} className="text-rose-600" aria-hidden="true" /> Safety centre &amp; SOS</button>
        <button type="button" onClick={onOpenDriver} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left text-sm font-semibold text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"><Car size={17} className="text-teal-700" aria-hidden="true" /> Drive with NexaGo</button>
        <button type="button" onClick={onOpenWallet} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left text-sm font-semibold text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"><Wallet size={17} className="text-teal-700" aria-hidden="true" /> NexaPay wallet &amp; PIN</button>
        <a href="mailto:support@nexago.ng" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-sm font-semibold text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"><LifeBuoy size={17} className="text-teal-700" aria-hidden="true" /> Contact support</a>
      </div>

      <button type="button" onClick={onLogout} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><LogOut size={16} aria-hidden="true" /> Sign out</button>
    </div>
  )
}
