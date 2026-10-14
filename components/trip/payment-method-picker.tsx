'use client'

import { Banknote, CreditCard, Landmark, type LucideIcon } from 'lucide-react'
import type { RidePaymentMethod } from '../../lib/api'

export const paymentMethodOptions: { value: RidePaymentMethod; label: string; detail: string; icon: LucideIcon }[] = [
  { value: 'CASH', label: 'Cash', detail: 'Pay your driver', icon: Banknote },
  { value: 'BANK_TRANSFER', label: 'Transfer', detail: 'From any bank app', icon: Landmark },
  { value: 'CARD', label: 'Card', detail: 'Visa, Mastercard, Verve', icon: CreditCard },
]

export function paymentMethodLabel(method: RidePaymentMethod) {
  return paymentMethodOptions.find((option) => option.value === method)?.label ?? 'Cash'
}

type PaymentMethodPickerProps = {
  value: RidePaymentMethod
  onChange: (method: RidePaymentMethod) => void
  label?: string
}

export function PaymentMethodPicker({ value, onChange, label = 'Payment method' }: PaymentMethodPickerProps) {
  return (
    <fieldset>
      <legend className="text-xs font-bold text-slate-700">{label}</legend>
      <div role="radiogroup" aria-label={label} className="mt-2 grid grid-cols-3 gap-2">
        {paymentMethodOptions.map(({ value: option, label: optionLabel, detail, icon: Icon }) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className="flex flex-col items-start gap-1 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-teal-300 aria-checked:border-teal-700 aria-checked:bg-teal-50 aria-checked:ring-2 aria-checked:ring-teal-700/15"
          >
            <Icon size={18} className="text-teal-800" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-900">{optionLabel}</span>
            <span className="text-[10px] leading-4 text-slate-500">{detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
