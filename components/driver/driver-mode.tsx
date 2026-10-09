'use client'

import { Car, CheckCircle2, Clock, MapPin, Navigation, Power, RefreshCw, Route, Wallet, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  getCurrentDriverRide,
  getDriverWallet,
  listAvailableDriverRides,
  runDriverRideAction,
  updateDriverLocation,
  type DriverRide,
  type DriverRideAction,
} from '../../lib/api'
import { formatKobo, friendlyError } from '../../lib/format'
import { isServiceNotLive } from '../service-unavailable'

type DriverModeProps = {
  isDriver: boolean
  signedIn: boolean
  onSignInAsDriver: () => void
  onToast: (message: string) => void
}

const LOCATION_PING_MS = 15000
const REQUEST_POLL_MS = 8000

const nextStep: Record<string, { action: DriverRideAction; label: string } | undefined> = {
  ACCEPTED: { action: 'arrived', label: 'I’ve arrived at pickup' },
  DRIVER_ARRIVED: { action: 'start', label: 'Start trip' },
  IN_PROGRESS: { action: 'complete', label: 'Complete trip' },
}

const statusCopy: Record<string, string> = {
  ACCEPTED: 'Heading to pickup',
  DRIVER_ARRIVED: 'Waiting for rider',
  IN_PROGRESS: 'Trip in progress',
}

function fareOf(ride: DriverRide) {
  const kobo = ride.finalFareKobo ?? ride.estimatedFareKobo
  return typeof kobo === 'number' ? formatKobo(kobo) : '—'
}

function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available on this device.'))
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Allow location access so riders can find you.')), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    })
  })
}

export function DriverMode({ isDriver, signedIn, onSignInAsDriver, onToast }: DriverModeProps) {
  const [online, setOnline] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [actionRideId, setActionRideId] = useState('')
  const [error, setError] = useState('')
  const pingTimer = useRef<number | null>(null)

  const enabled = signedIn && isDriver
  const current = useSWR(enabled ? 'driver-current-ride' : null, getCurrentDriverRide, { refreshInterval: online ? REQUEST_POLL_MS : 0 })
  const activeRide = current.data ?? null
  const available = useSWR(enabled && online && !activeRide ? 'driver-available-rides' : null, listAvailableDriverRides, { refreshInterval: REQUEST_POLL_MS })
  const wallet = useSWR(enabled ? 'driver-wallet' : null, getDriverWallet)

  const sendPing = useCallback(async (isOnline: boolean) => {
    const position = await readPosition()
    await updateDriverLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      heading: position.coords.heading ?? undefined,
      isOnline,
    })
  }, [])

  useEffect(() => {
    if (!online) return
    pingTimer.current = window.setInterval(() => { void sendPing(true).catch(() => undefined) }, LOCATION_PING_MS)
    return () => { if (pingTimer.current) window.clearInterval(pingTimer.current) }
  }, [online, sendPing])

  const toggleOnline = async () => {
    setToggling(true)
    setError('')
    try {
      await sendPing(!online)
      setOnline(!online)
      onToast(online ? 'You’re offline. You won’t receive new requests.' : 'You’re online. New ride requests will appear here.')
    } catch (toggleError) {
      setError(friendlyError(toggleError))
    } finally {
      setToggling(false)
    }
  }

  const runAction = async (ride: DriverRide, action: DriverRideAction) => {
    setActionRideId(ride.id)
    setError('')
    try {
      await runDriverRideAction(ride.id, action, action === 'cancel' ? 'Driver cancelled' : undefined)
      if (action === 'complete') {
        onToast('Trip completed. Earnings are added to your driver wallet.')
        void wallet.mutate()
      }
      await Promise.all([current.mutate(), available.mutate()])
    } catch (actionError) {
      setError(friendlyError(actionError))
      void available.mutate()
    } finally {
      setActionRideId('')
    }
  }

  if (!signedIn || !isDriver) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-800"><Car size={26} aria-hidden="true" /></span>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Drive with NexaGo</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
          {signedIn ? 'You’re signed in as a rider. Sign in with your driver phone number to go online and accept trips.' : 'Sign in with your driver phone number to go online, accept nearby trips, and track your earnings.'}
        </p>
        <button type="button" onClick={onSignInAsDriver} className="mt-5 h-12 w-full rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900">Sign in as a driver</button>
      </section>
    )
  }

  const activeStatus = activeRide?.status ?? ''
  const step = nextStep[activeStatus]
  const requests = available.data ?? []
  const driverUnavailable = isServiceNotLive(current.error)

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <section className={`rounded-3xl p-5 text-white shadow-lg transition-colors ${online ? 'bg-gradient-to-br from-[#0f5132] to-[#17696a]' : 'bg-gradient-to-br from-slate-800 to-slate-700'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/60">Driver status</p>
            <h2 className="mt-1 text-2xl font-bold">{online ? 'You’re online' : 'You’re offline'}</h2>
            <p className="mt-1 text-xs text-white/70">{online ? 'Sharing your location with nearby riders' : 'Go online to start receiving trips'}</p>
          </div>
          <button type="button" onClick={() => void toggleOnline()} disabled={toggling || Boolean(activeRide && online)} aria-pressed={online} className={`grid size-16 shrink-0 place-items-center rounded-full border-4 transition disabled:opacity-60 ${online ? 'border-emerald-300 bg-emerald-400 text-emerald-950' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}`}>
            <Power size={26} aria-hidden="true" />
            <span className="sr-only">{online ? 'Go offline' : 'Go online'}</span>
          </button>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-3.5">
          <Wallet size={18} aria-hidden="true" className="text-white/70" />
          <span className="text-xs text-white/70">Driver wallet</span>
          <strong className="ml-auto text-lg">{wallet.data ? formatKobo(wallet.data.balanceKobo) : wallet.isLoading ? '…' : '—'}</strong>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
      {driverUnavailable && <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">Driver trips aren’t available on this server yet. Complete driver verification, then try again.</p>}

      {activeRide ? (
        <section aria-labelledby="active-trip-title" className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 id="active-trip-title" className="text-base font-bold text-slate-900">{statusCopy[activeStatus] ?? 'Current trip'}</h3>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">{fareOf(activeRide)}</span>
          </div>
          <TripRoute ride={activeRide} />
          {activeRide.pickupLat !== undefined && activeRide.status === 'ACCEPTED' && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeRide.pickupLat},${activeRide.pickupLng}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-teal-300"><Navigation size={16} aria-hidden="true" />Navigate to pickup</a>
          )}
          {activeRide.destinationLat !== undefined && activeRide.status === 'IN_PROGRESS' && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeRide.destinationLat},${activeRide.destinationLng}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-teal-300"><Navigation size={16} aria-hidden="true" />Navigate to drop-off</a>
          )}
          {step && <button type="button" onClick={() => void runAction(activeRide, step.action)} disabled={actionRideId === activeRide.id} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60"><CheckCircle2 size={17} aria-hidden="true" />{actionRideId === activeRide.id ? 'Updating…' : step.label}</button>}
          {activeRide.status !== 'IN_PROGRESS' && <button type="button" onClick={() => void runAction(activeRide, 'cancel')} disabled={actionRideId === activeRide.id} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"><XCircle size={16} aria-hidden="true" />Cancel trip</button>}
        </section>
      ) : (
        <section aria-labelledby="requests-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 id="requests-title" className="text-base font-bold text-slate-900">Nearby requests</h3>
            {online && <button type="button" onClick={() => void available.mutate()} aria-label="Refresh requests" className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><RefreshCw size={16} className={available.isValidating ? 'animate-spin' : ''} /></button>}
          </div>
          {!online ? (
            <p className="py-8 text-center text-sm text-slate-500">Go online to see ride requests near you.</p>
          ) : available.isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-slate-500">Looking for riders nearby…</p>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center">
              <span className="mx-auto block size-3 animate-pulse rounded-full bg-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Waiting for requests</p>
              <p className="mt-1 text-xs text-slate-500">Stay online. New trips appear here automatically.</p>
            </div>
          ) : (
            <ul className="mt-3 grid gap-3">
              {requests.map((ride) => (
                <li key={ride.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-lg text-slate-900">{fareOf(ride)}</strong>
                    <span className="flex items-center gap-3 text-[11px] text-slate-500">
                      {typeof ride.estimatedDistanceKm === 'number' && <span className="flex items-center gap-1"><Route size={13} aria-hidden="true" />{ride.estimatedDistanceKm.toFixed(1)} km</span>}
                      {typeof ride.estimatedDurationMinutes === 'number' && <span className="flex items-center gap-1"><Clock size={13} aria-hidden="true" />{Math.round(ride.estimatedDurationMinutes)} min</span>}
                    </span>
                  </div>
                  <TripRoute ride={ride} />
                  <button type="button" onClick={() => void runAction(ride, 'accept')} disabled={Boolean(actionRideId)} className="mt-3 h-11 w-full rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">{actionRideId === ride.id ? 'Accepting…' : 'Accept trip'}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function TripRoute({ ride }: { ride: DriverRide }) {
  return (
    <ol className="mt-3 grid gap-2 text-sm">
      <li className="flex items-start gap-2.5"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" /><span><span className="sr-only">Pickup: </span>{ride.pickupAddress || 'Pinned pickup location'}</span></li>
      <li className="flex items-start gap-2.5"><MapPin size={14} className="mt-0.5 shrink-0 text-orange-500" aria-hidden="true" /><span><span className="sr-only">Drop-off: </span>{ride.destinationAddress || 'Pinned drop-off location'}</span></li>
    </ol>
  )
}
