'use client'

import { useMemo, useState } from 'react'
import { listRideHistory, type Ride } from '../../lib/api'
import useSWR from 'swr'
import { BottomSheet } from '../bottom-sheet'

const historyFetcher = () => listRideHistory(50)

function rideText(ride: Ride, names: string[]) {
  for (const name of names) {
    const value = ride[name]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

export function RideActivity() {
  const { data, error, isLoading, mutate } = useSWR('nexago-rider-history', historyFetcher, { revalidateOnFocus: true })
  const rides = useMemo(() => [...(data ?? [])].sort((a, b) => Date.parse(rideText(b, ['completedAt', 'updatedAt', 'createdAt'])) - Date.parse(rideText(a, ['completedAt', 'updatedAt', 'createdAt']))), [data])
  const [selected, setSelected] = useState<Ride | null>(null)
  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-teal-800">YOUR NEXAGO</p><h2 className="mt-1 text-xl font-bold">Rides &amp; activity</h2></div><button type="button" onClick={() => void mutate()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-teal-800">Refresh</button></div>
    {isLoading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading ride history…</p> : error ? <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p role="alert">Ride history could not be loaded.</p><button type="button" onClick={() => void mutate()} className="mt-2 font-bold underline">Try again</button></div> : rides.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Your completed and recent rides will appear here when available.</p> : <ul className="mt-4 divide-y divide-slate-100">{rides.map((ride) => {
      const date = rideText(ride, ['completedAt', 'updatedAt', 'createdAt'])
      const status = rideText(ride, ['status']) || 'Ride'
      const pickup = rideText(ride, ['pickupAddress', 'pickup'])
      const dropoff = rideText(ride, ['destinationAddress', 'dropoffAddress', 'destination', 'dropoff'])
      const amount = typeof ride.finalFareKobo === 'number' ? ride.finalFareKobo / 100 : typeof ride.estimatedFareKobo === 'number' ? ride.estimatedFareKobo / 100 : typeof ride.finalFare === 'number' ? ride.finalFare : null
      return <li key={ride.id}><button type="button" onClick={() => setSelected(ride)} className="w-full py-4 text-left"><span className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{pickup || dropoff ? `${pickup || 'Pickup'} → ${dropoff || 'Destination'}` : `Ride ${ride.id.slice(0, 8)}`}</strong><span className="text-xs font-semibold text-teal-800">{status.replace(/_/g, ' ')}</span></span><span className="mt-1 block text-xs text-slate-500">{date && !Number.isNaN(Date.parse(date)) ? new Date(date).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'}{amount !== null ? ` · ₦${amount.toLocaleString('en-NG')}` : ''}</span></button></li>
    })}</ul>}
    {selected && <BottomSheet title="Ride details" onClose={() => setSelected(null)}><div className="grid gap-3 text-sm"><p><span className="text-slate-500">Status:</span> {rideText(selected, ['status']) || 'Unavailable'}</p><p><span className="text-slate-500">Ride reference:</span> {selected.id}</p><p><span className="text-slate-500">Pickup:</span> {rideText(selected, ['pickupAddress', 'pickup']) || 'Unavailable'}</p><p><span className="text-slate-500">Destination:</span> {rideText(selected, ['destinationAddress', 'dropoffAddress', 'destination', 'dropoff']) || 'Unavailable'}</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexago:open-support', { detail: { rideId: selected.id } }))} className="mt-2 rounded-xl bg-teal-800 px-4 py-3 text-center text-sm font-bold text-white">Report an issue with this ride</button></div></BottomSheet>}
  </section>
}
