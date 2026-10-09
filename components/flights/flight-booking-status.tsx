'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Car, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { FlightBookingStatus, FlightBookingStatusResponse } from '@/lib/flights/types'
import { ItineraryLines } from './flight-offer-item'

const PENDING: FlightBookingStatus[] = ['checkout_pending', 'booking_in_progress']

const COPY: Record<FlightBookingStatus, { title: string; detail: string; tone: 'success' | 'pending' | 'error' }> = {
  checkout_pending: { title: 'Confirming your payment', detail: 'This usually takes a few seconds.', tone: 'pending' },
  booking_in_progress: { title: 'Issuing your ticket', detail: 'Payment received. We are confirming your seat with the airline.', tone: 'pending' },
  confirmed: { title: 'You are booked', detail: 'Your ticket is confirmed. Use the booking reference at check-in.', tone: 'success' },
  payment_failed: { title: 'Payment was not completed', detail: 'You have not been charged. Search again to book.', tone: 'error' },
  booking_failed_refund_pending: { title: 'Ticket not issued — refund in progress', detail: 'The airline could not issue this ticket. Your refund is being processed.', tone: 'error' },
  refunded: { title: 'Ticket not issued — refunded', detail: 'The airline could not issue this ticket, so your payment has been refunded.', tone: 'error' },
  manual_review: { title: 'We are checking your booking', detail: 'Your payment is safe. We will confirm your ticket or refund you.', tone: 'pending' },
}

const fetchStatus = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'Booking not found.')
  return body as FlightBookingStatusResponse
}

export function FlightBookingStatusView({ bookingId }: { bookingId: string }) {
  const { data, error } = useSWR(`/api/flights/bookings/${bookingId}`, fetchStatus, {
    refreshInterval: (latest) => (!latest || PENDING.includes(latest.status) ? 3000 : 0),
  })

  const copy = data ? COPY[data.status] : null
  const Icon = copy?.tone === 'success' ? CheckCircle2 : copy?.tone === 'error' ? XCircle : Clock

  return (
    <main className="min-h-[100dvh] bg-[#f6f8f7] px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
        <p className="text-[10px] font-bold tracking-[.18em] text-teal-800">NEXAGO FLIGHTS</p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-800">{error.message}</p>
        ) : !data || !copy ? (
          <p role="status" className="mt-4 text-sm text-slate-500">Loading your booking…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start gap-3">
              <Icon size={28} className={copy.tone === 'success' ? 'text-teal-700' : copy.tone === 'error' ? 'text-rose-600' : 'text-orange-500'} aria-hidden="true" />
              <div><h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1><p className="mt-1 text-sm text-slate-500">{copy.detail}</p></div>
            </div>
            {data.bookingReference && (
              <div className="mt-5 rounded-2xl bg-teal-50 p-4"><span className="block text-[10px] font-bold tracking-[.14em] text-teal-800">BOOKING REFERENCE</span><strong className="mt-1 block font-mono text-2xl tracking-widest text-slate-900">{data.bookingReference}</strong></div>
            )}
            {data.itinerary && <div className="mt-5 rounded-2xl border border-slate-200 p-4"><ItineraryLines itinerary={data.itinerary} /></div>}
          </>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/?screen=rides" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600"><Car size={16} /> Book an airport ride</Link>
          <Link href="/?screen=flights" className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to flights</Link>
        </div>
      </section>
    </main>
  )
}
