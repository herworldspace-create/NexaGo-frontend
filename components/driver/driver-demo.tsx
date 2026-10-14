'use client'

import { ArrowLeft, Banknote, CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DriverRide } from '../../lib/api'
import { EarningsPanel, NavigateLink, OnlineHeader, RequestCard, TripRoute, driverStatusCopy, fareKoboOf, fareOf, nextDriverStep } from './driver-ui'

type DemoRide = DriverRide & { paysCash: boolean }

type DemoTrip = Required<Pick<DriverRide, 'pickupAddress' | 'destinationAddress' | 'pickupLat' | 'pickupLng' | 'destinationLat' | 'destinationLng' | 'estimatedDistanceKm' | 'estimatedDurationMinutes' | 'estimatedFareKobo'>> & { paysCash: boolean }

const DEMO_TRIPS: DemoTrip[] = [
  { pickupAddress: 'Ikeja City Mall, Alausa', destinationAddress: 'Murtala Muhammed Airport, Ikeja', pickupLat: 6.6142, pickupLng: 3.3581, destinationLat: 6.5774, destinationLng: 3.3212, estimatedDistanceKm: 6.4, estimatedDurationMinutes: 18, estimatedFareKobo: 280000, paysCash: true },
  { pickupAddress: 'Yaba Tech, Herbert Macaulay Way', destinationAddress: 'Lekki Phase 1 Gate', pickupLat: 6.5191, pickupLng: 3.3747, destinationLat: 6.4478, destinationLng: 3.4723, estimatedDistanceKm: 17.2, estimatedDurationMinutes: 42, estimatedFareKobo: 640000, paysCash: false },
  { pickupAddress: 'Surulere, Adeniran Ogunsanya', destinationAddress: 'National Theatre, Iganmu', pickupLat: 6.4969, pickupLng: 3.3554, destinationLat: 6.4762, destinationLng: 3.3688, estimatedDistanceKm: 3.8, estimatedDurationMinutes: 12, estimatedFareKobo: 150000, paysCash: true },
  { pickupAddress: 'Victoria Island, Adeola Odeku', destinationAddress: 'Ikoyi, Awolowo Road', pickupLat: 6.4318, pickupLng: 3.4203, destinationLat: 6.4498, destinationLng: 3.4342, estimatedDistanceKm: 4.1, estimatedDurationMinutes: 14, estimatedFareKobo: 210000, paysCash: false },
]

const NEXT_STATUS: Record<string, string> = { ACCEPTED: 'DRIVER_ARRIVED', DRIVER_ARRIVED: 'IN_PROGRESS' }
const REQUEST_INTERVAL_MS = 6000

function makeRide(index: number): DemoRide {
  return { ...DEMO_TRIPS[index % DEMO_TRIPS.length], id: `demo-${index}`, status: 'REQUESTED' }
}

type DriverDemoProps = {
  onExit: () => void
  onSignInAsDriver: () => void
  onToast: (message: string) => void
}

export function DriverDemo({ onExit, onSignInAsDriver, onToast }: DriverDemoProps) {
  const [online, setOnline] = useState(false)
  const [requests, setRequests] = useState<DemoRide[]>([])
  const [nextIndex, setNextIndex] = useState(0)
  const [activeRide, setActiveRide] = useState<DemoRide | null>(null)
  const [awaitingCash, setAwaitingCash] = useState<DemoRide | null>(null)
  const [walletKobo, setWalletKobo] = useState(1250000)
  const [sessionKobo, setSessionKobo] = useState(0)
  const [cashKobo, setCashKobo] = useState(0)
  const [tripsCompleted, setTripsCompleted] = useState(0)

  useEffect(() => {
    if (!online || activeRide || requests.length >= 2) return
    const timer = window.setTimeout(() => {
      setRequests((current) => [...current, makeRide(nextIndex)])
      setNextIndex((index) => index + 1)
    }, requests.length === 0 ? 1500 : REQUEST_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [online, activeRide, requests.length, nextIndex])

  const toggleOnline = () => {
    setOnline((current) => !current)
    if (online) setRequests([])
    onToast(online ? 'Demo: you’re offline.' : 'Demo: you’re online. Simulated requests are on the way.')
  }

  const accept = (ride: DemoRide) => {
    setRequests((current) => current.filter((item) => item.id !== ride.id))
    setActiveRide({ ...ride, status: 'ACCEPTED' })
  }

  const decline = (ride: DemoRide) => {
    setRequests((current) => current.filter((item) => item.id !== ride.id))
    onToast('Request declined.')
  }

  const advance = () => {
    if (!activeRide) return
    const next = NEXT_STATUS[activeRide.status ?? '']
    if (next) {
      setActiveRide({ ...activeRide, status: next })
      return
    }
    const fare = fareKoboOf(activeRide)
    setSessionKobo((total) => total + fare)
    setTripsCompleted((count) => count + 1)
    if (activeRide.paysCash) {
      setAwaitingCash(activeRide)
    } else {
      setWalletKobo((total) => total + fare)
      onToast(`Rider paid ${fareOf(activeRide)} by transfer. Added to your wallet.`)
    }
    setActiveRide(null)
  }

  const confirmCash = () => {
    if (!awaitingCash) return
    setCashKobo((total) => total + fareKoboOf(awaitingCash))
    setAwaitingCash(null)
    onToast('Cash payment confirmed.')
  }

  const step = activeRide ? nextDriverStep[activeRide.status ?? ''] : undefined

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
        <p className="text-xs leading-5 text-orange-900"><strong className="font-bold">Demo mode.</strong> Requests, payments and earnings here are simulated.</p>
        <button type="button" onClick={onSignInAsDriver} className="shrink-0 text-xs font-bold text-orange-900 underline underline-offset-2">Sign in to drive</button>
      </div>

      <OnlineHeader online={online} toggling={false} locked={Boolean(activeRide)} onToggle={toggleOnline} badge="Demo" />
      <EarningsPanel walletKobo={walletKobo} sessionKobo={sessionKobo} tripsCompleted={tripsCompleted} cashKobo={cashKobo} />

      {awaitingCash && (
        <section aria-label="Collect cash" className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><Banknote size={18} aria-hidden="true" /></span>
            <div><p className="text-sm font-bold text-slate-900">Collect {fareOf(awaitingCash)} in cash</p><p className="mt-0.5 text-xs leading-5 text-slate-600">This rider chose to pay with cash.</p></div>
          </div>
          <button type="button" onClick={confirmCash} className="h-10 shrink-0 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-700">Cash received</button>
        </section>
      )}

      {activeRide ? (
        <section aria-labelledby="demo-active-title" className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 id="demo-active-title" className="text-base font-bold text-slate-900">{driverStatusCopy[activeRide.status ?? ''] ?? 'Current trip'}</h3>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">{fareOf(activeRide)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Rider pays by {activeRide.paysCash ? 'cash' : 'bank transfer'}</p>
          <TripRoute ride={activeRide} />
          {activeRide.status === 'ACCEPTED' && <NavigateLink latitude={activeRide.pickupLat} longitude={activeRide.pickupLng} label="Navigate to pickup" />}
          {activeRide.status === 'IN_PROGRESS' && <NavigateLink latitude={activeRide.destinationLat} longitude={activeRide.destinationLng} label="Navigate to drop-off" />}
          {step && <button type="button" onClick={advance} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900"><CheckCircle2 size={17} aria-hidden="true" />{step.label}</button>}
          {activeRide.status !== 'IN_PROGRESS' && <button type="button" onClick={() => { setActiveRide(null); onToast('Demo trip cancelled.') }} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50"><XCircle size={16} aria-hidden="true" />Cancel trip</button>}
        </section>
      ) : (
        <section aria-labelledby="demo-requests-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 id="demo-requests-title" className="text-base font-bold text-slate-900">Incoming requests</h3>
          {!online ? (
            <p className="py-8 text-center text-sm text-slate-500">Go online to receive simulated ride requests.</p>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center" role="status">
              <span className="mx-auto block size-3 animate-pulse rounded-full bg-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Looking for riders nearby…</p>
            </div>
          ) : (
            <ul className="mt-3 grid gap-3">
              {requests.map((ride) => <RequestCard key={ride.id} ride={ride} busy={false} accepting={false} onAccept={() => accept(ride)} onDecline={() => decline(ride)} />)}
            </ul>
          )}
        </section>
      )}

      <button type="button" onClick={onExit} className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-teal-800"><ArrowLeft size={15} aria-hidden="true" />Exit demo</button>
    </div>
  )
}
