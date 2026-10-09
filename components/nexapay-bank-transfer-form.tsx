'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import PinModal from './PinModal'
import { isServiceNotLive, ServiceUnavailable } from './service-unavailable'
import {
  getBankTransferQuote,
  getBanks,
  resolveBankAccount,
  sendBankTransfer,
  verifyBankTransfer,
  ApiError,
  type BankAccountResolution,
  type BankTransferResult,
} from '../lib/api'

type Props = { onSignIn: () => void; onComplete: () => void }

const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'
const labelClass = 'grid gap-1.5 text-xs font-semibold text-slate-700'

function formatNaira(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(kobo / 100)
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return 'Sign in to continue with your NexaGo account.'
  if (error instanceof ApiError && error.status === 0) return 'Connection interrupted. Your request key is retained; check the transfer status before trying again.'
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export function NexaPayBankTransferForm({ onSignIn, onComplete }: Props) {
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [resolved, setResolved] = useState<BankAccountResolution | null>(null)
  const [transfer, setTransfer] = useState<BankTransferResult | null>(null)
  const [resolving, setResolving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)

  const amountKobo = Math.round(Number(amount) * 100)
  const { data: banks = [], error: banksError, isLoading: banksLoading } = useSWR('nexapay-banks', getBanks, { revalidateOnFocus: false })
  const { data: quote, error: quoteError } = useSWR(
    Number.isSafeInteger(amountKobo) && amountKobo > 0 ? ['nexapay-bank-quote', amountKobo] : null,
    ([, value]) => getBankTransferQuote(value),
    { revalidateOnFocus: false },
  )

  const handleResolve = async () => {
    setError('')
    setResolving(true)
    try {
      const result = await resolveBankAccount(accountNumber, bankCode)
      setResolved(result)
    } catch (requestError) {
      setResolved(null)
      setError(errorMessage(requestError))
    } finally {
      setResolving(false)
    }
  }

  const handleInitialSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!resolved || resolved.bankCode !== bankCode || resolved.accountLast4 !== accountNumber.slice(-4)) {
      setError('Verify the recipient account again before sending.')
      return
    }
    if (!quote || !Number.isSafeInteger(amountKobo)) {
      setError('Enter an amount within the supported transfer limits.')
      return
    }
    // Open the secure PinModal instead of executing immediately
    setIsPinModalOpen(true)
  }

  const handleExecuteTransfer = async (pin: string) => {
    setSubmitting(true)
    try {
      const key = idempotencyKey || globalThis.crypto.randomUUID()
      if (!idempotencyKey) setIdempotencyKey(key)
      const result = await sendBankTransfer({ accountNumber, bankCode, amountKobo, pin, idempotencyKey: key })
      setTransfer(result)
      onComplete()
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError // Handled inside PinModal to display error if invalid
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async () => {
    if (!transfer) return
    setChecking(true)
    setError('')
    try {
      const result = await verifyBankTransfer(transfer.id)
      setTransfer(result)
      if (result.status === 'SUCCESSFUL' || result.status === 'FAILED' || result.status === 'REVERSED') onComplete()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setChecking(false)
    }
  }

  if (isServiceNotLive(banksError)) {
    return <ServiceUnavailable title="Bank transfers are on the way" description="Sending money to Nigerian bank accounts will be available here soon. You can still send money to other NexaGo users." />
  }

  if (transfer) {
    const pending = transfer.status === 'PENDING' || transfer.status === 'OTP_REQUIRED'
    const complete = transfer.status === 'SUCCESSFUL'
    return <div className="grid gap-4 py-2">
      <div role="status" aria-live="polite" className={`rounded-2xl border p-4 ${pending ? 'border-amber-200 bg-amber-50' : complete ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <p className="text-sm font-bold text-slate-900">{pending ? 'Transfer processing' : complete ? 'Transfer complete' : 'Transfer not completed'}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{pending ? 'Paystack has not confirmed the final bank outcome yet. Your wallet debit is reserved; do not submit another transfer.' : complete ? `Sent ${formatNaira(transfer.amountKobo)} to ${transfer.accountName}.` : transfer.failureReason ?? 'The transfer was reversed.'}</p>
        <p className="mt-2 text-[11px] text-slate-500">{transfer.bankName} ·•••• {transfer.accountLast4} · Ref {transfer.reference}</p>
        <p className="mt-1 text-[11px] text-slate-500">Transfer fee: {formatNaira(transfer.feeKobo)}</p>
      </div>
      {pending && <button type="button" onClick={() => void handleVerify()} disabled={checking} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60">{checking ? 'Checking status…' : 'Check transfer status'}</button>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}{error.includes('Sign in') && <button type="button" onClick={onSignIn} className="ml-1 font-bold underline">Sign in</button>}</p>}
      <p className="text-center text-[10px] leading-4 text-slate-400">Transfer status is confirmed by Paystack webhooks or verification, not by the browser.</p>
    </div>
  }

  return (
    <>
      <form className="mt-4 grid gap-3.5" onSubmit={handleInitialSubmit}>
        {banksError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{errorMessage(banksError)}{banksError instanceof ApiError && banksError.status === 401 && <button type="button" onClick={onSignIn} className="ml-1 font-bold underline">Sign in</button>}</p>}
        <label className={labelClass}>Bank<select required value={bankCode} onChange={(event) => { setBankCode(event.target.value); setResolved(null) }} disabled={banksLoading || banks.length === 0} className={fieldClass}><option value="">{banksLoading ? 'Loading banks…' : 'Choose a bank'}</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label>
        <label className={labelClass}>10-digit account number<input required inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{10}" value={accountNumber} onChange={(event) => { setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10)); setResolved(null) }} placeholder="0123456789" className={fieldClass} /></label>
        <button type="button" onClick={() => void handleResolve()} disabled={resolving || !bankCode || accountNumber.length !== 10} className="h-11 rounded-xl border border-teal-700 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">{resolving ? 'Verifying account…' : 'Verify account name'}</button>
        {resolved && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3"><p className="text-xs font-bold text-emerald-900">{resolved.accountName}</p><p className="mt-1 text-[11px] text-emerald-800">{resolved.bankName} ·•••• {resolved.accountLast4}</p></div>}
        <label className={labelClass}>Amount in naira<input required type="number" min="1" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₦ 0" className={fieldClass} /></label>
        {quote && <dl className="grid gap-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs"><div className="flex justify-between"><dt className="text-slate-500">Transfer fee</dt><dd className="font-semibold text-slate-800">{formatNaira(quote.feeKobo)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Total wallet debit</dt><dd className="font-bold text-slate-900">{formatNaira(quote.totalKobo)}</dd></div></dl>}
        {quoteError && <p role="alert" className="text-xs leading-5 text-rose-700">{errorMessage(quoteError)}</p>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}{error.includes('Sign in') && <button type="button" onClick={onSignIn} className="ml-1 font-bold underline">Sign in</button>}</p>}
        <button type="submit" disabled={submitting || !resolved || !quote} className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Sending securely…' : 'Send bank transfer'}</button>
        <p className="text-center text-[10px] leading-4 text-slate-400">Review the verified recipient and total before confirming. Never share your PIN.</p>
      </form>

      {/* Secure Transaction PIN Popup Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handleExecuteTransfer}
        title="Authorize Bank Transfer"
        description={resolved ? `Enter PIN to send ${amount ? formatNaira(amountKobo) : ''} to ${resolved.accountName}` : undefined}
      />
    </>
  )
}
