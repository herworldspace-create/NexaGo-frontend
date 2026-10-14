'use client'

import { Banknote, Clock, MapPin, Navigation, Power, Route, TrendingUp, Wallet } from 'lucide-react'
import type { DriverRide, DriverRideAction } from '../../lib/api'
import { formatKobo } from '../../lib/format'

export function fareOf(ride: DriverRide) {
  const kobo = ride.finalFareKobo ?? ride.estimatedFareKobo
  return typeof kobo === 'number' ? formatKobo(kobo) : '—'
}

export function fareKoboOf(ride: DriverRide) {
  return ride.finalFareKobo ?? ride.estimatedFareKobo ?? 0
}

export function TripRoute({ ride }: { ride: DriverRide }) {
  return (
    <ol className="mt-3 grid gap-2 text-sm">
      <li className="flex items-start gap-2.5"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" /><span><span className="sr-only">Pickup: </span>{ride.pickupAddress || 'Pinned pickup location'}</span></li>
      <li className="flex items-start gap-2.5"><MapPin size={14} className="mt-0.5 shrink-0 text-orange-500" aria-hidden="true" /><span><span className="sr-only">Drop-off: </span>{ride.destinationAddress || 'Pinned drop-off location'}</span></li>
    </ol>
  )
}

export function TripMeta({ ride }: { ride: DriverRide }) {
  return (
    <span className="flex items-center gap-3 text-[11px] text-slate-500">
      {typeof ride.estimatedDistanceKm === 'number' && <span className="flex items-center gap-1"><Route size={13} aria-hidden="true" />{ride.estimatedDistanceKm.toFixed(1)} km</span>}
      {typeof ride.estimatedDurationMinutes === 'number' && <span className="flex items-center gap-1"><Clock size={13} aria-hidden="true" />{Math.round(ride.estimatedDurationMinutes)} min</span>}
    </span>
  )
}

export function NavigateLink({ latitude, longitude, label }: { latitude?: number; longitude?: number; label: string }) {
  if (latitude === undefined || longitude === undefined) return null
  return (
    <a href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-teal-300">
      <Navigation size={16} aria-hidden="true" />{label}
    </a>
  )
}

type EarningsPanelProps = {
  walletKobo: number | null
  walletLoading?: boolean
  sessionKobo: number
  tripsCompleted: number
  cashKobo: number
}

export function EarningsPanel({ walletKobo, walletLoading, sessionKobo, tripsCompleted, cashKobo }: EarningsPanelProps) {
  const average = tripsCompleted > 0 ? Math.round(sessionKobo / tripsCompleted) : 0
  return (
    <section aria-labelledby="earnings-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 id="earnings-title" className="text-base font-bold text-slate-900">Earnings</h3>
        <span className="flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800"><Wallet size={12} aria-hidden="true" />Wallet {walletKobo !== null ? formatKobo(walletKobo) : walletLoading ? '…' : '—'}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon={TrendingUp} label="This shift" value={formatKobo(sessionKobo)} />
        <Stat icon={Route} label="Trips" value={String(tripsCompleted)} />
        <Stat icon={Banknote} label="Cash collected" value={formatKobo(cashKobo)} />
        <Stat icon={Clock} label="Avg. per trip" value={formatKobo(average)} />
      </dl>
    </section>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><Icon size={12} aria-hidden="true" />{label}</dt>
      <dd className="mt-1 text-base font-bold text-slate-900">{value}</dd>
    </div>
  )
}

export const nextDriverStep: Record<string, { action: DriverRideAction; label: string } | undefined> = {
  ACCEPTED: { action: 'arrived', label: 'I’ve arrived at pickup' },
  DRIVER_ARRIVED: { action: 'start', label: 'Start trip' },
  IN_PROGRESS: { action: 'complete', label: 'Complete trip' },
}

export const driverStatusCopy: Record<string, string> = {
  ACCEPTED: 'Heading to pickup',
  DRIVER_ARRIVED: 'Waiting for rider',
  IN_PROGRESS: 'Trip in progress',
}

export function OnlineHeader({ online, toggling, locked, onToggle, badge }: { online: boolean; toggling: boolean; locked: boolean; onToggle: () => void; badge?: string }) {
  return (
    <section className={`rounded-3xl p-5 text-white shadow-lg transition-colors ${online ? 'bg-gradient-to-br from-[#0f5132] to-[#17696a]' : 'bg-gradient-to-br from-slate-800 to-slate-700'}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-white/60">Driver status{badge && <span className="rounded-full bg-orange-400 px-2 py-0.5 text-[9px] tracking-wide text-orange-950">{badge}</span>}</p>
          <h2 className="mt-1 text-2xl font-bold">{online ? 'You’re online' : 'You’re offline'}</h2>
          <p className="mt-1 text-xs text-white/70">{online ? 'Sharing your location with nearby riders' : 'Go online to start receiving trips'}</p>
        </div>
        <button type="button" onClick={onToggle} disabled={toggling || locked} aria-pressed={online} className={`grid size-16 shrink-0 place-items-center rounded-full border-4 transition disabled:opacity-60 ${online ? 'border-emerald-300 bg-emerald-400 text-emerald-950' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}`}>
          <Power size={26} aria-hidden="true" />
          <span className="sr-only">{online ? 'Go offline' : 'Go online'}</span>
        </button>
      </div>
    </section>
  )
}

export function RequestCard({ ride, busy, accepting, onAccept, onDecline }: { ride: DriverRide; busy: boolean; accepting: boolean; onAccept: () => void; onDecline: () => void }) {
  return (
    <li className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-lg text-slate-900">{fareOf(ride)}</strong>
        <TripMeta ride={ride} />
      </div>
      <TripRoute ride={ride} />
      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={onDecline} disabled={busy} className="h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Decline</button>
        <button type="button" onClick={onAccept} disabled={busy} className="h-11 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">{accepting ? 'Accepting…' : 'Accept trip'}</button>
      </div>
    </li>
  )
}
