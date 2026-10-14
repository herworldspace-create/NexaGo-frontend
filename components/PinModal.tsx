'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Lock, X } from 'lucide-react'

type PinModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (pin: string) => Promise<void> | void
  title?: string
  description?: string
}

function pinErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Your PIN could not be verified. Try again.'
}

export default function PinModal({ isOpen, onClose, onSuccess, title = 'Enter transaction PIN', description }: PinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setPin('')
    setError('')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose, submitting])

  if (!isOpen) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Your PIN is 4 to 6 digits.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSuccess(pin)
      setPin('')
      onClose()
    } catch (submitError) {
      setPin('')
      setError(pinErrorMessage(submitError))
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pin-modal-title" className="w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-800"><Lock size={19} aria-hidden="true" /></span>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close PIN prompt" className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={18} /></button>
        </div>
        <h2 id="pin-modal-title" className="mt-4 text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>}
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 grid gap-3">
          <label htmlFor="transaction-pin" className="sr-only">Transaction PIN</label>
          <input
            ref={inputRef}
            id="transaction-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            minLength={4}
            maxLength={6}
            value={pin}
            onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            placeholder="••••"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'transaction-pin-error' : undefined}
            className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
          />
          {error && <p id="transaction-pin-error" role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
          <button type="submit" disabled={submitting || pin.length < 4} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Authorizing…' : 'Confirm'}</button>
          <p className="text-center text-[10px] leading-4 text-slate-400">NexaGo will never ask for your PIN by phone, SMS, or email.</p>
        </form>
      </section>
    </div>
  )
}
