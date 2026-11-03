'use client'

import { useState } from 'react'
import { AlertTriangle, Camera, ShieldCheck } from 'lucide-react'
import { getIdentityVerificationStatus, type CurrentUser, type IdentityVerificationStatus } from '../lib/api'
import useSWR from 'swr'

interface ProfileProps {
  user?: CurrentUser | null
  signedIn?: boolean
  loading?: boolean
  onOpenWallet?: () => void
  onOpenSafety?: () => void
  onOpenHistory?: () => void
  onOpenSupport?: () => void
  onUserUpdated?: (updated: CurrentUser) => void
  onSignIn?: () => void
  onLogout?: () => void
}

const verificationFetcher = (): Promise<IdentityVerificationStatus> => getIdentityVerificationStatus()

export default function Profile({ user, loading = false, onOpenWallet, onOpenSafety, onOpenHistory, onOpenSupport, onLogout }: ProfileProps) {
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const { data: verification, error: verificationError, isLoading: verificationLoading } = useSWR('nexago-identity-verification', verificationFetcher, { revalidateOnFocus: true })
  const status = String(verification?.status ?? user?.passengerProfile?.verificationStatus ?? '').toLowerCase()
  const verificationLabel = status === 'verified' || status === 'approved' ? 'Verified' : status === 'pending' || status === 'processing' || status === 'submitted' ? 'Verification pending' : status === 'rejected' || status === 'failed' ? 'Verification needs attention' : 'Not verified'
  const fullName = user?.passengerProfile?.fullName?.trim() || 'NexaGo rider'
  const isVerified = status === 'verified' || status === 'approved'
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : null
  const buttonClass = 'w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100'

  return <div className="grid gap-4">
    <section className="rounded-2xl bg-[#0b4d44] p-5 text-white">
      <div className="flex items-center gap-4">
        <div className="grid size-14 place-items-center rounded-full border-2 border-emerald-400 bg-slate-700 text-xl font-bold">{fullName.charAt(0).toUpperCase()}</div>
        <div className="min-w-0"><h3 className="truncate text-lg font-bold">{loading ? 'Loading profile…' : fullName}</h3><p className="text-xs text-emerald-200">{verificationLoading ? 'Checking verification…' : verificationLabel}{verificationError && <span className="ml-1 text-amber-300">(status unavailable)</span>}</p>{memberSince && <p className="mt-1 text-[10px] text-slate-300">Member since {memberSince}</p>}</div>
      </div>
      <div className="mt-4 grid gap-1 text-xs text-slate-200"><span>{user?.email || 'No email on file'}</span><span>{user?.phone || 'No phone number on file'}</span></div>
      <button type="button" onClick={() => setVerificationOpen((open) => !open)} aria-expanded={verificationOpen} className="mt-4 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold hover:bg-white/10">{verificationOpen ? 'Hide verification details' : 'View verification details'}</button>
      {verificationOpen && <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs leading-5">{verificationError ? 'Verification status could not be loaded. Your account status is unconfirmed.' : verification?.status ? `Current status: ${String(verification.status)}${verification.verifiedAt ? ` · verified ${new Date(verification.verifiedAt).toLocaleDateString('en-NG')}` : ''}${verification.reason ? ` · ${verification.reason}` : ''}` : 'No verification result is available yet. Your identity has not been confirmed by NexaGo.'}</div>}
      {!isVerified && <button type="button" onClick={() => setOnboardingOpen((open) => !open)} aria-expanded={onboardingOpen} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-teal-900 hover:bg-teal-50">{onboardingOpen ? 'Hide identity steps' : 'Start identity setup'}</button>}
    </section>
    {onboardingOpen && !isVerified && <section aria-labelledby="identity-setup-title" className="rounded-2xl border border-slate-200 bg-white p-4"><h3 id="identity-setup-title" className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck size={17} className="text-teal-800" />Identity setup</h3><p className="mt-1 text-xs leading-5 text-slate-600">NIN and selfie checks require an approved secure verification service. This app does not currently have one connected.</p><div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Your identity remains unverified or pending until NexaGo confirms it. No verification happens in this screen.</div><div className="mt-4 grid gap-3"><label className="grid gap-1 text-xs font-semibold text-slate-700">NIN (11 digits)<input disabled autoComplete="off" inputMode="numeric" maxLength={11} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:cursor-not-allowed" placeholder="Unavailable until secure submission is connected" /></label><div className="grid gap-1 text-xs font-semibold text-slate-700">Selfie capture<button type="button" disabled className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500 disabled:cursor-not-allowed"><Camera size={15} />Capture unavailable until secure submission is connected</button></div><p role="status" className="rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-700">Status: not submitted. This screen cannot upload or store your NIN or selfie.</p></div></section>}
    <nav aria-label="Profile shortcuts" className="grid gap-2">
      {onOpenHistory && <button type="button" onClick={onOpenHistory} className={buttonClass}>🧾 &nbsp; Rides &amp; activity</button>}
      {onOpenWallet && <button type="button" onClick={onOpenWallet} className={buttonClass}>💳 &nbsp; NexaPay wallet &amp; PIN</button>}
      {onOpenSupport && <button type="button" onClick={onOpenSupport} className={buttonClass}>🎧 &nbsp; Help &amp; report a trip issue</button>}
      {onOpenSafety && <button type="button" onClick={onOpenSafety} className={buttonClass}>🛡️ &nbsp; Safety &amp; emergency</button>}
    </nav>
    {onLogout && <button type="button" onClick={onLogout} className="w-full rounded-2xl bg-rose-50 py-3.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100">Sign out</button>}
  </div>
}
