'use client'

import { Check, Copy, MessageCircle, MessageSquare, Plus, Trash2, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { createSplitFare, type SplitFareParticipant } from '../../lib/api'
import { formatKobo, formatNaira, friendlyError, normalizeNigerianPhone } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'
import { isServiceNotLive } from '../service-unavailable'

const MAX_OTHER_RIDERS = 3

type SplitFareSheetProps = {
  rideId: string
  fareAmount: number | null
  onClose: () => void
  onToast: (message: string) => void
}

type SplitResult = {
  participants: SplitFareParticipant[]
  shareUrl?: string | null
  viaNexaPay: boolean
}

function splitShares(total: number, people: number) {
  const base = Math.floor(total / people)
  const remainder = total - base * people
  return Array.from({ length: people }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function SplitFareSheet({ rideId, fareAmount, onClose, onToast }: SplitFareSheetProps) {
  const [phones, setPhones] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SplitResult | null>(null)

  const validPhones = phones.map(normalizeNigerianPhone).filter((phone): phone is string => Boolean(phone))
  const riderCount = validPhones.length + 1
  const shares = fareAmount ? splitShares(Math.round(fareAmount), riderCount) : null

  const updatePhone = (index: number, value: string) => setPhones((current) => current.map((phone, position) => position === index ? value : phone))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const filled = phones.filter((phone) => phone.trim())
    if (filled.length === 0) return setError('Add at least one rider to split with.')
    if (filled.length !== validPhones.length) return setError('Check the phone numbers. Use a Nigerian number like 0801 234 5678.')
    if (new Set(validPhones).size !== validPhones.length) return setError('Each rider can only be added once.')
    setSubmitting(true)
    setError('')
    try {
      const split = await createSplitFare(rideId, validPhones)
      setResult({ participants: split.participants, shareUrl: split.shareUrl, viaNexaPay: true })
    } catch (splitError) {
      if (isServiceNotLive(splitError)) {
        setResult({
          participants: validPhones.map((phone, index) => ({ phone, amountKobo: shares ? shares[index + 1] * 100 : undefined, status: 'Request by message' })),
          viaNexaPay: false,
        })
      } else {
        setError(friendlyError(splitError))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const tripCode = rideId.slice(0, 8).toUpperCase()
    const messageFor = (participant: SplitFareParticipant) => {
      const amount = typeof participant.amountKobo === 'number' ? formatKobo(participant.amountKobo) : 'your share'
      return result.viaNexaPay
        ? `Hi! I've split our NexaGo trip ${tripCode} with you. Your share is ${amount}.${result.shareUrl ? ` Pay here: ${result.shareUrl}` : ' Check your NexaPay app to pay.'}`
        : `Hi! Your share of our NexaGo trip ${tripCode} is ${amount}. Please send it to me on NexaPay or by transfer. Thanks!`
    }
    return (
      <BottomSheet title="Fare split ready" onClose={onClose}>
        <p className="mt-1 text-sm leading-6 text-slate-500">{result.viaNexaPay ? 'Each rider got a NexaPay request. Their share is paid from their wallet when they accept.' : 'Send each rider their share with one tap below.'}</p>
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {shares && (
            <li className="flex items-center justify-between gap-3 p-3.5">
              <span><span className="block text-sm font-semibold text-slate-800">Rider 1 · You</span><span className="text-xs text-slate-500">Paid from your wallet</span></span>
              <strong className="text-sm text-slate-900">{formatNaira(shares[0])}</strong>
            </li>
          )}
          {result.participants.map((participant, index) => {
            const message = encodeURIComponent(messageFor(participant))
            const digits = participant.phone.replace(/\D/g, '')
            return (
              <li key={participant.phone} className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span><span className="block text-sm font-semibold text-slate-800">Rider {index + 2}</span><span className="text-xs text-slate-500">{participant.phone}</span></span>
                  <span className="flex items-center gap-2">
                    {typeof participant.amountKobo === 'number' && <strong className="text-sm text-slate-900">{formatKobo(participant.amountKobo)}</strong>}
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">{(participant.status ?? 'Pending').toLowerCase()}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={`https://wa.me/${digits}?text=${message}`} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-teal-300"><MessageCircle size={14} className="text-emerald-600" aria-hidden="true" />WhatsApp</a>
                  <a href={`sms:${participant.phone}?body=${message}`} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-teal-300"><MessageSquare size={14} className="text-teal-700" aria-hidden="true" />SMS</a>
                </div>
              </li>
            )
          })}
        </ul>
        {result.shareUrl && (
          <button type="button" onClick={() => { void navigator.clipboard.writeText(result.shareUrl ?? '').then(() => onToast('Split link copied.')).catch(() => onToast('Copy is unavailable in this browser.')) }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-300"><Copy size={16} aria-hidden="true" />Copy split link</button>
        )}
        <button type="button" onClick={onClose} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white"><Check size={16} aria-hidden="true" />Done</button>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Split fare" description="Share this trip’s cost equally with up to 3 other riders." onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-2xl bg-teal-50 p-4">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-teal-800"><Users size={18} aria-hidden="true" /></span>
            <span><span className="block text-xs text-slate-500">{riderCount} riders · each pays about</span><strong className="text-xl font-bold text-slate-900">{shares ? formatNaira(shares[shares.length - 1]) : '—'}</strong></span>
          </span>
          {fareAmount !== null && <span className="text-right text-[11px] text-slate-500">Total<br /><strong className="text-sm text-slate-800">{formatNaira(fareAmount)}</strong></span>}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
          <span className="grid size-7 place-items-center rounded-full bg-teal-800 text-[11px] font-bold text-white">1</span>
          <span className="flex-1 text-sm font-semibold text-slate-800">Rider 1 · You</span>
          {shares && <span className="text-sm font-bold text-slate-900">{formatNaira(shares[0])}</span>}
        </div>

        {phones.map((phone, index) => {
          const valid = normalizeNigerianPhone(phone)
          const share = shares && valid ? shares[validPhones.indexOf(valid) + 1] : null
          return (
            <div key={index} className="grid gap-1.5">
              <label htmlFor={`split-phone-${index}`} className="text-xs font-semibold text-slate-700">Rider {index + 2} phone number</label>
              <div className="flex items-center gap-2">
                <input id={`split-phone-${index}`} type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(event) => updatePhone(index, event.target.value)} placeholder="0801 234 5678" aria-invalid={Boolean(phone.trim()) && !valid} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 aria-[invalid=true]:border-rose-300" />
                {share !== null && share !== undefined && <span className="w-20 text-right text-sm font-bold text-slate-900">{formatNaira(share)}</span>}
                {phones.length > 1 && <button type="button" onClick={() => setPhones((current) => current.filter((_, position) => position !== index))} aria-label={`Remove rider ${index + 2}`} className="grid size-12 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><Trash2 size={16} /></button>}
              </div>
            </div>
          )
        })}
        {phones.length < MAX_OTHER_RIDERS && <button type="button" onClick={() => setPhones((current) => [...current, ''])} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-teal-400 hover:bg-teal-50"><Plus size={15} aria-hidden="true" />Add Rider {phones.length + 2}</button>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
        <button type="submit" disabled={submitting} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60">{submitting ? 'Splitting…' : `Split between ${riderCount} riders`}</button>
      </form>
    </BottomSheet>
  )
}
