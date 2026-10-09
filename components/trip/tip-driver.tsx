'use client'

import { HandCoins } from 'lucide-react'
import { useState } from 'react'
import { tipDriver } from '../../lib/api'
import { formatNaira, friendlyError } from '../../lib/format'
import { isServiceNotLive } from '../service-unavailable'

const TIP_PRESETS = [200, 500, 1000]
const MAX_TIP = 20000

export function TipDriver({ rideId, onTipped }: { rideId: string; onTipped: (message: string) => void }) {
  const [amount, setAmount] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const value = custom ? Number(custom) : amount

  const sendTip = async () => {
    if (!value || !Number.isInteger(value) || value < 50 || value > MAX_TIP) {
      setError(`Choose a tip between ₦50 and ${formatNaira(MAX_TIP)}.`)
      return
    }
    setSending(true)
    setError('')
    try {
      await tipDriver(rideId, value)
      setSent(true)
      onTipped(`${formatNaira(value)} tip sent from your NexaPay wallet.`)
    } catch (tipError) {
      setError(isServiceNotLive(tipError) ? 'Tipping isn’t live on the NexaGo server yet. You haven’t been charged.' : friendlyError(tipError))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-xs font-semibold text-emerald-800">Thank you! Your driver received your tip.</p>
  }

  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-700"><HandCoins size={14} className="text-teal-700" aria-hidden="true" />Add a tip (optional)</legend>
      <div className="flex flex-wrap gap-2">
        {TIP_PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => { setAmount(preset); setCustom(''); setError('') }} aria-pressed={!custom && amount === preset} className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition ${!custom && amount === preset ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}>{formatNaira(preset)}</button>
        ))}
        <label className="sr-only" htmlFor={`tip-custom-${rideId}`}>Custom tip in naira</label>
        <input id={`tip-custom-${rideId}`} type="number" min="50" max={MAX_TIP} step="50" inputMode="numeric" value={custom} onChange={(event) => { setCustom(event.target.value); setError('') }} placeholder="Other ₦" className="h-9 w-24 rounded-full border border-slate-200 px-3 text-xs outline-none focus:border-teal-600" />
      </div>
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-700">{error}</p>}
      <button type="button" onClick={() => void sendTip()} disabled={sending || !value} className="mt-3 h-10 w-full rounded-xl border border-teal-700 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Sending tip…' : value ? `Tip ${formatNaira(value)} with NexaPay` : 'Choose a tip amount'}</button>
    </fieldset>
  )
}
