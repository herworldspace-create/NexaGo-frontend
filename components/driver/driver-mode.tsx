'use client'

import { Banknote, Car, CheckCircle2, PlayCircle, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  confirmCashPayment,
  getCurrentDriverRide,
  getDriverWallet,
  listAvailableDriverRides,
  runDriverRideAction,
  updateDriverLocation,
  type DriverRide,
  type DriverRideAction,
} from '../../lib/api'
import { friendlyError } from '../../lib/format'
import { isServiceNotLive } from '../service-unavailable'
import { DriverDemo } from './driver-demo'
import { EarningsPanel, NavigateLink, OnlineHeader, RequestCard, TripRoute, driverStatusCopy, fareKoboOf, fareOf, nextDriverStep } from './driver-ui'

type DriverModeProps = {
  isDriver: boolean
  signedIn: boolean
  onSignInAsDriver: () => void
  onToast: (message: string) => void
}

const LOCATION_PING_MS = 15000
const REQUEST_POLL_MS = 8000

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
  const [demo, setDemo] = useState(false)

  if (!signedIn || !isDriver) {
    if (demo) return <DriverDemo onExit={() => setDemo(false)} onSignInAsDriver={onSignInAsDriver} onToast={onToast} />
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-800"><Car size={26} aria-hidden="true" /></span>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Drive with NexaGo</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
          {signedIn ? 'You’re signed in as a rider. Sign in with your driver account to go online and accept trips.' : 'Sign in with your driver account to go online, accept nearby trips, and track your earnings.'}
        </p>
        <button type="button" onClick={onSignInAsDriver} className="mt-5 h-12 w-full rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900">Sign in as a driver</button>
        <button type="button" onClick={() => setDemo(true)} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50"><PlayCircle size={17} aria-hidden="true" />Try the driver demo</button>
      </section>
    )
  }

  return <LiveDriverMode onToast={onToast} />
}

function LiveDriverMode({ onToast }: { onToast: (message: string) => void }) {
  const [online, setOnline] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [actionRideId, setActionRideId] = useState('')
  const [error, setError] = useState('')
  const [declined, setDeclined] = useState<string[]>([])
  const [sessionKobo, setSessionKobo] = useState(0)
  const [cashKobo, setCashKobo] = useState(0)
  const [tripsCompleted, setTripsCompleted] = useState(0)
  const [awaitingCash, setAwaitingCash] = useState<DriverRide | null>(null)
  const [confirmingCash, setConfirmingCash] = useState(false)
  const pingTimer = useRef<number | null>(null)

  const current = useSWR('driver-current-ride', getCurrentDriverRide, { refreshInterval: online ? REQUEST_POLL_MS : 0 })
  const activeRide = current.data ?? null
  const available = useSWR(online && !activeRide ? 'driver-available-rides' : null, listAvailableDriverRides, { refreshInterval: REQUEST_POLL_MS })
  const wallet = useSWR('driver-wallet', getDriverWallet)

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
      const updated = await runDriverRideAction(ride.id, action, action === 'cancel' ? 'Driver cancelled' : undefined)
      if (action === 'complete') {
        const completed = { ...ride, ...updated }
        setSessionKobo((total) => total + fareKoboOf(completed))
        setTripsCompleted((count) => count + 1)
        setAwaitingCash(completed)
        onToast('Trip completed. Card and transfer payments go straight to your wallet.')
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

  const declineRequest = (ride: DriverRide) => {
    setDeclined((current) => [...current, ride.id])
    onToast('Request declined. We’ll keep looking for trips near you.')
  }

  const confirmCash = async () => {
    if (!awaitingCash) return
    setConfirmingCash(true)
    setError('')
    try {
      await confirmCashPayment(awaitingCash.id)
      setCashKobo((total) => total + fareKoboOf(awaitingCash))
      setAwaitingCash(null)
      onToast('Cash payment confirmed.')
      void wallet.mutate()
    } catch (cashError) {
      const message = friendlyError(cashError)
      setError(/not.*cash|no.*payment|not found/i.test(message) ? 'This rider didn’t choose cash, or hasn’t picked a payment method yet. Their payment will settle in-app.' : message)
    } finally {
      setConfirmingCash(false)
    }
  }

  const activeStatus = activeRide?.status ?? ''
  const step = nextDriverStep[activeStatus]
  const requests = (available.data ?? []).filter((ride) => !declined.includes(ride.id))
  const driverUnavailable = isServiceNotLive(current.error)

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <OnlineHeader online={online} toggling={toggling} locked={Boolean(activeRide && online)} onToggle={() => void toggleOnline()} />

      <EarningsPanel walletKobo={wallet.data?.balanceKobo ?? null} walletLoading={wallet.isLoading} sessionKobo={sessionKobo} tripsCompleted={tripsCompleted} cashKobo={cashKobo} />

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
      {driverUnavailable && <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">Driver trips aren’t available on this server yet. Complete driver verification, then try again.</p>}

      {awaitingCash && (
        <section aria-label="Collect payment" className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><Banknote size={18} aria-hidden="true" /></span>
            <div><p className="text-sm font-bold text-slate-900">Paid in cash? Collect {fareOf(awaitingCash)}</p><p className="mt-0.5 text-xs leading-5 text-slate-600">Confirm once you’ve received the cash. Skip if the rider paid by card or transfer.</p></div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setAwaitingCash(null)} className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold text-slate-600">Skip</button>
            <button type="button" onClick={() => void confirmCash()} disabled={confirmingCash} className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-60">{confirmingCash ? 'Confirming…' : 'Cash received'}</button>
          </div>
        </section>
      )}

      {activeRide ? (
        <section aria-labelledby="active-trip-title" className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 id="active-trip-title" className="text-base font-bold text-slate-900">{driverStatusCopy[activeStatus] ?? 'Current trip'}</h3>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">{fareOf(activeRide)}</span>
          </div>
          <TripRoute ride={activeRide} />
          {activeRide.status === 'ACCEPTED' && <NavigateLink latitude={activeRide.pickupLat} longitude={activeRide.pickupLng} label="Navigate to pickup" />}
          {activeRide.status === 'IN_PROGRESS' && <NavigateLink latitude={activeRide.destinationLat} longitude={activeRide.destinationLng} label="Navigate to drop-off" />}
          {step && <button type="button" onClick={() => void runAction(activeRide, step.action)} disabled={actionRideId === activeRide.id} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60"><CheckCircle2 size={17} aria-hidden="true" />{actionRideId === activeRide.id ? 'Updating…' : step.label}</button>}
          {activeRide.status !== 'IN_PROGRESS' && <button type="button" onClick={() => void runAction(activeRide, 'cancel')} disabled={actionRideId === activeRide.id} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"><XCircle size={16} aria-hidden="true" />Cancel trip</button>}
        </section>
      ) : (
        <section aria-labelledby="requests-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 id="requests-title" className="text-base font-bold text-slate-900">Incoming requests</h3>
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
                <RequestCard key={ride.id} ride={ride} busy={Boolean(actionRideId)} accepting={actionRideId === ride.id} onAccept={() => void runAction(ride, 'accept')} onDecline={() => declineRequest(ride)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
