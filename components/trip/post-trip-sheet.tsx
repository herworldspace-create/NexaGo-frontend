'use client'

import { Banknote, Check, HandCoins, Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { payForRide, submitRideRating, tipDriver, type RidePaymentMethod } from '../../lib/api'
import { formatNaira, friendlyError } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'
import { isServiceNotLive } from '../service-unavailable'
import { PaymentMethodPicker, paymentMethodLabel } from './payment-method-picker'

const POSITIVE_TAGS = ['Great driver', 'Safe driving', 'Clean car', 'Friendly', 'On time', 'Great route', 'Cool AC']
const NEGATIVE_TAGS = ['Unsafe driving', 'Late pickup', 'Dirty car', 'Rude', 'Wrong route', 'Overcharged']
const SCORE_COPY = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent']
const TIP_PRESETS = [200, 500, 1000]
const MIN_TIP = 50
const MAX_TIP = 20000

type PostTripSheetProps = {
  rideId: string
  fareAmount: number | null
  initialPaymentMethod: RidePaymentMethod
  email?: string | null
  onClose: () => void
  onDone: (message: string) => void
}

type PaymentState = 'unpaid' | 'paying' | 'cash' | 'checkout' | 'paid'

export function PostTripSheet({ rideId, fareAmount, initialPaymentMethod, email, onClose, onDone }: PostTripSheetProps) {
  const [method, setMethod] = useState<RidePaymentMethod>(initialPaymentMethod)
  const [payment, setPayment] = useState<PaymentState>('unpaid')
  const [paymentError, setPaymentError] = useState('')

  const [score, setScore] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [tipPreset, setTipPreset] = useState<number | null>(null)
  const [customTip, setCustomTip] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const tipAmount = customTip ? Number(customTip) : tipPreset
  const tagOptions = score >= 4 ? POSITIVE_TAGS : score > 0 ? NEGATIVE_TAGS : []
  const fareLabel = fareAmount !== null ? formatNaira(fareAmount) : 'your fare'
  const paymentSettled = payment === 'cash' || payment === 'checkout' || payment === 'paid'

  const startPayment = async () => {
    if (method !== 'CASH' && !email) {
      setPaymentError('Card and transfer payments need an email on your account. Add one in your profile, or pay with cash.')
      return
    }
    setPayment('paying')
    setPaymentError('')
    try {
      const result = await payForRide(rideId, method, email ?? undefined)
      if (method === 'CASH') {
        setPayment('cash')
        return
      }
      if (!result.authorizationUrl) throw new Error('The payment page could not be opened. Please try again.')
      window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer')
      setPayment('checkout')
    } catch (payError) {
      const message = friendlyError(payError)
      if (/already been paid/i.test(message)) {
        setPayment('paid')
      } else if (/already in progress/i.test(message)) {
        setPayment('checkout')
      } else {
        setPayment('unpaid')
        setPaymentError(isServiceNotLive(payError) ? 'In-app payment isn’t live yet. Please pay your driver directly.' : message)
      }
    }
  }

  const chooseScore = (value: number) => {
    if ((value >= 4) !== (score >= 4)) setTags([])
    setScore(value)
    setError('')
  }

  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (score < 1) return setError('Choose a star rating before submitting.')
    if (tipAmount !== null && (!Number.isInteger(tipAmount) || tipAmount < MIN_TIP || tipAmount > MAX_TIP)) {
      return setError(`Tips must be a whole amount between ${formatNaira(MIN_TIP)} and ${formatNaira(MAX_TIP)}.`)
    }
    const note = [tags.length ? `Tags: ${tags.join(', ')}` : '', comment.trim()].filter(Boolean).join(' — ')
    setSubmitting(true)
    setError('')
    try {
      await submitRideRating(rideId, score, note || undefined)
    } catch (ratingError) {
      setError(friendlyError(ratingError))
      setSubmitting(false)
      return
    }
    if (!tipAmount) {
      setSubmitting(false)
      onDone('Thanks for rating your trip.')
      return
    }
    try {
      await tipDriver(rideId, tipAmount)
      onDone(`Thanks for rating! ${formatNaira(tipAmount)} tip sent to your driver.`)
    } catch (tipError) {
      onDone(isServiceNotLive(tipError) ? 'Rating saved. Tipping isn’t live yet, so you weren’t charged.' : `Rating saved, but the tip failed: ${friendlyError(tipError)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet title="You’ve arrived" description="Settle your fare, then tell us how the trip went." onClose={onClose}>
      <section aria-labelledby="post-trip-pay" className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="post-trip-pay" className="text-xs font-bold uppercase tracking-wide text-slate-500">Trip fare</h3>
          <strong className="text-xl font-bold text-slate-900">{fareLabel}</strong>
        </div>
        {payment === 'cash' ? (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900"><Banknote size={16} className="mt-0.5 shrink-0" aria-hidden="true" />Please hand {fareLabel} in cash to your driver. They&apos;ll confirm once received.</p>
        ) : payment === 'checkout' ? (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-teal-50 px-3.5 py-3 text-xs leading-5 text-teal-900"><Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />Paystack checkout opened in a new tab. {method === 'BANK_TRANSFER' ? 'Transfer to the one-time account shown there.' : 'Complete your card payment there.'}</p>
        ) : payment === 'paid' ? (
          <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-xs font-semibold text-emerald-800"><Check size={16} aria-hidden="true" />This trip is fully paid.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            <PaymentMethodPicker value={method} onChange={(next) => { setMethod(next); setPaymentError('') }} label="How would you like to pay?" />
            {paymentError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{paymentError}</p>}
            <button type="button" onClick={() => void startPayment()} disabled={payment === 'paying'} className="h-11 rounded-xl bg-orange-500 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60">
              {payment === 'paying' ? 'Starting payment…' : method === 'CASH' ? `I’ll pay ${fareLabel} in cash` : `Pay ${fareLabel} by ${paymentMethodLabel(method).toLowerCase()}`}
            </button>
          </div>
        )}
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 grid gap-4">
        <fieldset>
          <legend className="text-xs font-semibold text-slate-700">How was your driver?</legend>
          <div className="mt-2 flex items-center gap-2" role="group" aria-label="Driver rating from one to five stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" onClick={() => chooseScore(value)} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} aria-pressed={score === value} className="grid size-11 place-items-center rounded-xl border border-slate-200 transition hover:border-amber-300 hover:bg-amber-50 aria-pressed:border-amber-300 aria-pressed:bg-amber-50">
                <Star size={20} className={score >= value ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} />
              </button>
            ))}
            {score > 0 && <span className="ml-1 text-xs font-semibold text-slate-600">{SCORE_COPY[score]}</span>}
          </div>
        </fieldset>

        {tagOptions.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">{score >= 4 ? 'What went well?' : 'What could be better?'}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} aria-pressed={tags.includes(tag)} className="h-9 rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 aria-pressed:border-teal-700 aria-pressed:bg-teal-50 aria-pressed:text-teal-800">{tag}</button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          Comment (optional)
          <textarea maxLength={800} value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Tell us more about your trip" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" />
        </label>

        <fieldset className="rounded-2xl border border-slate-200 p-4">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-700"><HandCoins size={14} className="text-teal-700" aria-hidden="true" />Add a tip (optional) · 100% goes to your driver</legend>
          <div className="flex flex-wrap gap-2">
            {TIP_PRESETS.map((preset) => {
              const active = !customTip && tipPreset === preset
              return (
                <button key={preset} type="button" onClick={() => { setTipPreset(active ? null : preset); setCustomTip(''); setError('') }} aria-pressed={active} className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition ${active ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}>{formatNaira(preset)}</button>
              )
            })}
            <label className="sr-only" htmlFor={`tip-custom-${rideId}`}>Custom tip in naira</label>
            <input id={`tip-custom-${rideId}`} type="number" min={MIN_TIP} max={MAX_TIP} step="50" inputMode="numeric" value={customTip} onChange={(event) => { setCustomTip(event.target.value); setTipPreset(null); setError('') }} placeholder="Custom ₦" className="h-9 w-28 rounded-full border border-slate-200 px-3 text-xs outline-none focus:border-teal-600" />
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Tips are paid from your NexaPay wallet.</p>
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
        <button type="submit" disabled={submitting || score === 0} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Submitting…' : tipAmount ? `Submit rating & tip ${formatNaira(tipAmount)}` : 'Submit rating'}
        </button>
        {!paymentSettled && <p className="-mt-2 text-center text-[10px] text-slate-400">You can rate now and settle your fare above at any time.</p>}
      </form>
    </BottomSheet>
  )
}
