'use client'

import { useState, type FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import type { FlightOfferCard, FlightPassengerDetails } from '@/lib/flights/types'
import { formatMoney } from '@/lib/flights/money'
import { ItineraryLines } from './flight-offer-item'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) : null

const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'
const labelClass = 'block text-[11px] font-semibold text-slate-600'

const emptyPassenger = (): FlightPassengerDetails => ({ title: 'mr', givenName: '', familyName: '', dateOfBirth: '', gender: 'm', email: '', phoneNumber: '+234' })

export function FlightPassengerCheckout({ offer, checkoutEnabled, onCancel }: { offer: FlightOfferCard; checkoutEnabled: boolean; onCancel: () => void }) {
  const [passengers, setPassengers] = useState<FlightPassengerDetails[]>(() => Array.from({ length: offer.passengerCount }, emptyPassenger))
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const update = (index: number, key: keyof FlightPassengerDetails, value: string) =>
    setPassengers((current) => current.map((passenger, position) => (position === index ? { ...passenger, [key]: value } : passenger)))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/flights/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, idempotencyKey, passengers }),
      })
      const body = await response.json()
      if (!response.ok || !body.clientSecret) throw new Error(body.error ?? 'Payment could not be started.')
      setClientSecret(body.clientSecret)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Payment could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Passenger details and payment">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold tracking-tight">{clientSecret ? 'Pay for your ticket' : 'Who is flying?'}</h2><p className="mt-1 text-xs text-slate-500">{offer.airlineName} · {formatMoney(offer.totalAmount, offer.totalCurrency)}</p></div>
        {!clientSecret && <button type="button" onClick={onCancel} className="text-xs font-semibold text-teal-800">Change flight</button>}
      </div>
      <div className="mb-5 rounded-2xl bg-slate-50 p-4"><ItineraryLines itinerary={offer} /></div>

      {clientSecret && stripePromise ? (
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {passengers.map((passenger, index) => (
            <fieldset key={index} className="rounded-2xl border border-slate-200 p-4">
              <legend className="px-1 text-xs font-bold text-slate-800">Passenger {index + 1}</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className={labelClass}>Title<select value={passenger.title} onChange={(event) => update(index, 'title', event.target.value)} className={fieldClass}><option value="mr">Mr</option><option value="ms">Ms</option><option value="mrs">Mrs</option><option value="miss">Miss</option><option value="dr">Dr</option></select></label>
                <label className={labelClass}>Gender on ID<select value={passenger.gender} onChange={(event) => update(index, 'gender', event.target.value)} className={fieldClass}><option value="m">Male</option><option value="f">Female</option></select></label>
                <label className={labelClass}>First name<input required autoComplete="given-name" value={passenger.givenName} onChange={(event) => update(index, 'givenName', event.target.value)} className={fieldClass} /></label>
                <label className={labelClass}>Last name<input required autoComplete="family-name" value={passenger.familyName} onChange={(event) => update(index, 'familyName', event.target.value)} className={fieldClass} /></label>
                <label className={labelClass}>Date of birth<input required type="date" autoComplete="bday" value={passenger.dateOfBirth} onChange={(event) => update(index, 'dateOfBirth', event.target.value)} className={fieldClass} /></label>
                <label className={labelClass}>Phone<input required type="tel" autoComplete="tel" value={passenger.phoneNumber} onChange={(event) => update(index, 'phoneNumber', event.target.value.replace(/[^\d+]/g, ''))} className={fieldClass} /></label>
                <label className={`${labelClass} col-span-2`}>Email<input required type="email" autoComplete="email" value={passenger.email} onChange={(event) => update(index, 'email', event.target.value)} className={fieldClass} /></label>
                {offer.requiresPassport && (
                  <>
                    <label className={labelClass}>Passport number<input required value={passenger.passportNumber ?? ''} onChange={(event) => update(index, 'passportNumber', event.target.value.toUpperCase())} className={fieldClass} /></label>
                    <label className={labelClass}>Issuing country<input required maxLength={2} placeholder="NG" value={passenger.passportIssuingCountry ?? ''} onChange={(event) => update(index, 'passportIssuingCountry', event.target.value.toUpperCase())} className={`${fieldClass} uppercase`} /></label>
                    <label className={`${labelClass} col-span-2`}>Passport expiry<input required type="date" value={passenger.passportExpiry ?? ''} onChange={(event) => update(index, 'passportExpiry', event.target.value)} className={fieldClass} /></label>
                  </>
                )}
              </div>
            </fieldset>
          ))}
          {!checkoutEnabled && <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">Ticket payment is not switched on yet, so this fare cannot be booked.</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
          <button type="submit" disabled={submitting || !checkoutEnabled || !stripePromise} className="h-12 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60">
            {submitting ? 'Confirming fare…' : `Continue to payment · ${formatMoney(offer.totalAmount, offer.totalCurrency)}`}
          </button>
        </form>
      )}
    </section>
  )
}
