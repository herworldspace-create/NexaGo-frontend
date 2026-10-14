'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import PinModal from './PinModal'
import { isServiceNotLive, ServiceUnavailable } from './service-unavailable'
import {
  ApiError,
  getRemitaBillServices,
  submitBillPayment,
  validateBillCustomer,
  verifyBillPayment,
  type BillCustomerValidation,
  type BillPaymentResult,
} from '../lib/api'

type Props = {
  onSignIn: () => void
  onComplete: () => void
}

const fieldClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'

const labelClass =
  'grid gap-1.5 text-xs font-semibold text-slate-700'

function formatNaira(kobo: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(kobo / 100)
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Sign in to continue with your NexaGo account.'
  }

  if (error instanceof ApiError && error.status === 0) {
    return 'Connection interrupted. Your request key is retained; check the payment status before trying again.'
  }

  return error instanceof Error
    ? error.message
    : 'The request could not be completed.'
}

export function NexaPayBillPaymentForm({
  onSignIn,
  onComplete,
}: Props) {
  const [serviceId, setServiceId] = useState('')
  const [customerReference, setCustomerReference] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [validation, setValidation] =
    useState<BillCustomerValidation | null>(null)
  const [payment, setPayment] =
    useState<BillPaymentResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)

  const {
    data: services = [],
    error: servicesError,
    isLoading: servicesLoading,
  } = useSWR(
    'nexapay-remita-services',
    getRemitaBillServices,
    { revalidateOnFocus: false },
  )

  const service = services.find(
    (item) => item.id === serviceId,
  )

  const handleValidate = async () => {
    if (!serviceId || !customerReference.trim()) {
      return
    }

    setValidating(true)
    setError('')

    try {
      const result = await validateBillCustomer({
        serviceId,
        customerReference: customerReference.trim(),
        ...(phoneNumber.trim()
          ? { phoneNumber: phoneNumber.trim() }
          : {}),
      })

      setValidation(result)
    } catch (requestError) {
      setValidation(null)
      setError(errorMessage(requestError))
    } finally {
      setValidating(false)
    }
  }

  const handleInitialSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    setError('')

    if (!service || !validation) {
      setError(
        'Choose a Remita service and check the customer details first.',
      )
      return
    }

    const amountKobo = Math.round(Number(amount) * 100)

    if (
      !Number.isSafeInteger(amountKobo) ||
      amountKobo <= 0
    ) {
      setError('Enter a valid amount in naira.')
      return
    }

    setIsPinModalOpen(true)
  }

  const handleExecutePayment = async (pin: string) => {
    setSubmitting(true)
    setError('')

    try {
      const key =
        idempotencyKey || globalThis.crypto.randomUUID()

      if (!idempotencyKey) {
        setIdempotencyKey(key)
      }

      const amountKobo = Math.round(Number(amount) * 100)

      const result = await submitBillPayment({
        serviceId,
        customerReference: customerReference.trim(),
        ...(phoneNumber.trim()
          ? { phoneNumber: phoneNumber.trim() }
          : {}),
        amountKobo,
        pin,
        idempotencyKey: key,
      })

      setPayment(result)
      setIsPinModalOpen(false)
      onComplete()
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async () => {
    if (!payment) return

    setChecking(true)
    setError('')

    try {
      const result = await verifyBillPayment(payment.id)

      setPayment(result)

      if (result.status !== 'PENDING') {
        onComplete()
      }
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setChecking(false)
    }
  }

  if (isServiceNotLive(servicesError)) {
    return (
      <ServiceUnavailable
        title="Bill payments are on the way"
        description="Electricity, TV, and other biller payments will be available here soon. Airtime and data are ready to use now."
      />
    )
  }

  if (payment) {
    const pending = payment.status === 'PENDING'
    const complete = payment.status === 'SUCCESSFUL'

    return (
      <div className="grid gap-4 py-2">
        <div
          role="status"
          aria-live="polite"
          className={`rounded-2xl border p-4 ${
            pending
              ? 'border-amber-200 bg-amber-50'
              : complete
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-rose-200 bg-rose-50'
          }`}
        >
          <p className="text-sm font-bold text-slate-900">
            {pending
              ? 'Payment processing'
              : complete
                ? 'Bill paid'
                : 'Payment failed'}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-600">
            {pending
              ? 'Remita has not confirmed the final result yet. The amount remains reserved; do not submit another payment.'
              : complete
                ? `Paid ${formatNaira(payment.amountKobo)} to ${payment.serviceName}.`
                : payment.failureReason ??
                  'The payment failed and your wallet balance was restored.'}
          </p>

          <p className="mt-2 text-[11px] text-slate-500">
            {payment.category} ·•••• {payment.customerReferenceLast4} ·
            Ref {payment.reference}
          </p>

          {payment.token && (
            <div className="mt-3 rounded-xl bg-white/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Prepaid token
              </p>

              <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900">
                {payment.token}
              </p>
            </div>
          )}
        </div>

        {pending && (
          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={checking}
            className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60"
          >
            {checking
              ? 'Checking status…'
              : 'Check payment status'}
          </button>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800"
          >
            {error}

            {error.includes('Sign in') && (
              <button
                type="button"
                onClick={onSignIn}
                className="ml-1 font-bold underline"
              >
                Sign in
              </button>
            )}
          </p>
        )}

        <p className="text-center text-[10px] leading-4 text-slate-400">
          A bill is complete only after Remita confirms the
          provider result.
        </p>
      </div>
    )
  }

  return (
    <>
      <form
        className="mt-4 grid gap-3.5"
        onSubmit={handleInitialSubmit}
      >
        {servicesError && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800"
          >
            {errorMessage(servicesError)}

            {servicesError instanceof ApiError &&
              servicesError.status === 401 && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="ml-1 font-bold underline"
                >
                  Sign in
                </button>
              )}
          </p>
        )}

        <label className={labelClass}>
          Bill provider

          <select
            required
            value={serviceId}
            onChange={(event) => {
              setServiceId(event.target.value)
              setValidation(null)
            }}
            disabled={
              servicesLoading || services.length === 0
            }
            className={fieldClass}
          >
            <option value="">
              {servicesLoading
                ? 'Loading Remita services…'
                : 'Choose a service'}
            </option>

            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.category}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          {service?.customerReferenceLabel ??
            'Customer reference'}

          <input
            required
            autoComplete="off"
            maxLength={64}
            value={customerReference}
            onChange={(event) => {
              setCustomerReference(event.target.value)
              setValidation(null)
            }}
            placeholder="Meter, decoder or account number"
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          Phone number (if required by provider)

          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.target.value)
              setValidation(null)
            }}
            placeholder="08012345678"
            className={fieldClass}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleValidate()}
          disabled={
            validating ||
            !serviceId ||
            !customerReference.trim()
          }
          className="h-12 rounded-xl border border-teal-700 bg-white text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {validating
            ? 'Checking customer…'
            : validation?.verified
              ? 'Customer verified ✓'
              : 'Verify customer'}
        </button>

        {validation && (
          <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              {validation.verified
                ? 'Customer details verified'
                : 'Customer could not be verified'}
            </p>

            {validation.customerName && (
              <p className="mt-1">
                Customer: {validation.customerName}
              </p>
            )}

            <p className="mt-1 text-[11px] text-slate-400">
              Verification: {validation.verificationMode}
            </p>
          </div>
        )}

        <label className={labelClass}>
          Amount (₦)

          <input
            required
            type="number"
            min="1"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value)
            }
            placeholder="Enter amount"
            className={fieldClass}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800"
          >
            {error}

            {error.includes('Sign in') && (
              <button
                type="button"
                onClick={onSignIn}
                className="ml-1 font-bold underline"
              >
                Sign in
              </button>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            !service ||
            !validation?.verified ||
            !amount
          }
          className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Processing…'
            : 'Continue to payment'}
        </button>

        <p className="text-center text-[10px] leading-4 text-slate-400">
          Verify the customer details before making a payment.
          Do not submit another payment while an earlier payment
          is still being confirmed.
        </p>
      </form>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          if (!submitting) {
            setIsPinModalOpen(false)
          }
        }}
        onSuccess={handleExecutePayment}
        title="Confirm bill payment"
        description={
          service
            ? `Pay ${formatNaira(
                Math.round(Number(amount) * 100),
              )} to ${service.name}.`
            : 'Enter your transaction PIN to continue.'
        }
      />
    </>
  )
}
