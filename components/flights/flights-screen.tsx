'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { ArrowLeft, ArrowRight, Car, Plane, ShieldCheck } from 'lucide-react'
import type { CabinClass, FlightOfferCard } from '@/lib/flights/types'
import { FlightOfferItem } from './flight-offer-item'
import { FlightPassengerCheckout } from './flight-passenger-checkout'

const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'
const labelClass = 'block text-[11px] font-semibold text-slate-600'

type FlightConfig = { searchEnabled: boolean; checkoutEnabled: boolean }

const fetchConfig = (url: string) => fetch(url).then((response) => response.json() as Promise<FlightConfig>)

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function FlightsScreen({ onBack, onBookAirportRide }: { onBack: () => void; onBookAirportRide: () => void }) {
  const { data: config, isLoading: configLoading } = useSWR('/api/flights/config', fetchConfig)
  const [origin, setOrigin] = useState('LOS')
  const [destination, setDestination] = useState('ABV')
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [adults, setAdults] = useState(1)
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy')
  const [offers, setOffers] = useState<FlightOfferCard[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedOffer, setSelectedOffer] = useState<FlightOfferCard | null>(null)

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearching(true)
    setSearchError('')
    setSelectedOffer(null)
    try {
      const response = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, departureDate, returnDate: returnDate || undefined, adults, cabinClass }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Flight search failed.')
      setOffers(body.offers)
    } catch (error) {
      setOffers(null)
      setSearchError(error instanceof Error ? error.message : 'Flight search failed.')
    } finally {
      setSearching(false)
    }
  }

  const unavailable = !configLoading && config && !config.searchEnabled

  return (
    <section className="mx-auto max-w-4xl">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-teal-800"><ArrowLeft size={15} /> Back to rides</button>
      <div className="mb-5">
        <p className="text-[10px] font-bold tracking-[.18em] text-teal-800">NEXAGO FLIGHTS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">Fly anywhere, ride to the gate.</h1>
        <p className="mt-2 text-sm text-slate-500">Search live fares, pay securely, and book your NexaGo ride to the airport.</p>
      </div>

      <button type="button" onClick={onBookAirportRide} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-left transition hover:border-orange-300">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-orange-600"><Car size={19} /></span>
        <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">Need a ride to the airport?</strong><span className="mt-0.5 block text-xs text-slate-600">Pin the airport as your drop-off and get a live fare.</span></span>
        <ArrowRight size={17} className="shrink-0 text-orange-600" />
      </button>

      {unavailable && (
        <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
          Flight search is not switched on yet. Once the airline-booking provider is connected, live fares will appear here. Airport rides are available now.
        </p>
      )}

      <form onSubmit={handleSearch} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Search flights">
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-lg font-bold tracking-tight">Search flights</h2><p className="mt-1 text-xs text-slate-500">Use airport codes, like LOS (Lagos) or ABV (Abuja).</p></div>
          <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Plane size={19} /></span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={labelClass}>From<input required maxLength={3} value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} className={`${fieldClass} uppercase`} autoComplete="off" /></label>
          <label className={labelClass}>To<input required maxLength={3} value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} className={`${fieldClass} uppercase`} autoComplete="off" /></label>
          <label className={labelClass}>Depart<input required type="date" min={today()} value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Return (optional)<input type="date" min={departureDate || today()} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Adults<select value={adults} onChange={(event) => setAdults(Number(event.target.value))} className={fieldClass}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          <label className={`${labelClass} col-span-1 sm:col-span-2`}>Cabin<select value={cabinClass} onChange={(event) => setCabinClass(event.target.value as CabinClass)} className={fieldClass}><option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option><option value="first">First</option></select></label>
          <div className="col-span-2 flex items-end sm:col-span-1">
            <button type="submit" disabled={searching || Boolean(unavailable) || configLoading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60">
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
        {searchError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{searchError}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck size={13} className="text-teal-700" /> Your ticket is only issued after payment is confirmed.</p>
      </form>

      {selectedOffer ? (
        <FlightPassengerCheckout offer={selectedOffer} checkoutEnabled={Boolean(config?.checkoutEnabled)} onCancel={() => setSelectedOffer(null)} />
      ) : offers && (
        <section className="mt-5" aria-label="Flight results">
          <h2 className="mb-3 text-sm font-bold text-slate-800">{offers.length ? `${offers.length} fares found` : 'No fares found for this search'}</h2>
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => <li key={offer.id}><FlightOfferItem offer={offer} onSelect={() => setSelectedOffer(offer)} /></li>)}
          </ul>
        </section>
      )}
    </section>
  )
}
