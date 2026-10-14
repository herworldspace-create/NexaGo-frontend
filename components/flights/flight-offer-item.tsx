import { Plane } from 'lucide-react'
import type { FlightItinerarySummary, FlightOfferCard } from '@/lib/flights/types'
import { formatMoney } from '@/lib/flights/money'

export function formatTime(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(value))
}

export function formatDuration(value: string | null) {
  const match = value?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return null
  const hours = Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0)
  return `${hours ? `${hours}h ` : ''}${Number(match[3] ?? 0)}m`
}

export function ItineraryLines({ itinerary }: { itinerary: FlightItinerarySummary }) {
  return (
    <div className="flex flex-col gap-3">
      {itinerary.slices.map((slice, index) => {
        const first = slice.segments[0]
        const last = slice.segments[slice.segments.length - 1]
        const stops = slice.segments.length - 1
        return (
          <div key={index} className="flex items-center gap-3">
            <div className="min-w-0"><strong className="block text-base text-slate-900">{slice.originCode}</strong><span className="block text-[11px] text-slate-500">{formatTime(first?.departingAt ?? '')}</span></div>
            <div className="flex min-w-0 flex-1 flex-col items-center text-[10px] text-slate-400">
              <span>{stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}</span>
              <span className="my-1 flex w-full items-center gap-1"><span className="h-px flex-1 bg-slate-200" /><Plane size={12} className="text-teal-700" /><span className="h-px flex-1 bg-slate-200" /></span>
              <span className="truncate">{slice.segments.map((segment) => segment.flightNumber).join(' · ')}</span>
            </div>
            <div className="min-w-0 text-right"><strong className="block text-base text-slate-900">{slice.destinationCode}</strong><span className="block text-[11px] text-slate-500">{formatTime(last?.arrivingAt ?? '')}</span></div>
          </div>
        )
      })}
    </div>
  )
}

export function FlightOfferItem({ offer, onSelect }: { offer: FlightOfferCard; onSelect: () => void }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="mb-3 text-xs font-semibold text-slate-700">{offer.airlineName}</p>
        <ItineraryLines itinerary={offer} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <div className="sm:text-right"><strong className="block text-lg text-slate-900">{formatMoney(offer.totalAmount, offer.totalCurrency)}</strong><span className="text-[10px] text-slate-500">Total for {offer.passengerCount} passenger{offer.passengerCount > 1 ? 's' : ''}</span></div>
        <button type="button" onClick={onSelect} className="h-10 rounded-xl bg-teal-700 px-4 text-xs font-bold text-white transition hover:bg-teal-800">Select</button>
      </div>
    </article>
  )
}
