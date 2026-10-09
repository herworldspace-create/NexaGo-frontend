'use client'

import { Flame, User } from 'lucide-react'
import type { VehicleCategory } from '../../lib/api'
import { formatNaira } from '../../lib/format'
import { rideTierOrder, rideTiers, tierKeyForCategory, type RideTierKey } from '../../lib/ride-tiers'

type RideTierSelectorProps = {
  categories: VehicleCategory[]
  selectedCategoryId: string
  onSelect: (category: VehicleCategory) => void
  estimate: { categoryId: string; amount: number | null; surge: number } | null
  estimating: boolean
  preview?: boolean
  onPreviewSelect?: () => void
}

export function RideTierSelector({ categories, selectedCategoryId, onSelect, estimate, estimating, preview = false, onPreviewSelect }: RideTierSelectorProps) {
  const categoryByTier = new Map<RideTierKey, VehicleCategory>()
  for (const category of categories) {
    const key = tierKeyForCategory(category)
    if (!categoryByTier.has(key)) categoryByTier.set(key, category)
  }

  return (
    <div role="radiogroup" aria-label="Ride type" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rideTierOrder.map((key) => {
        const tier = rideTiers[key]
        const category = categoryByTier.get(key)
        const selected = Boolean(category && category.id === selectedCategoryId)
        const Icon = tier.icon
        const showEstimate = selected && estimate?.categoryId === category?.id
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!category && !preview}
            onClick={() => preview ? onPreviewSelect?.() : category && onSelect(category)}
            className="relative flex min-h-[104px] flex-col items-start rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-teal-300 aria-checked:border-teal-700 aria-checked:bg-teal-50 aria-checked:ring-2 aria-checked:ring-teal-700/15 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-200"
          >
            <span className="flex w-full items-start justify-between">
              <span className={`grid size-9 place-items-center rounded-xl ${selected ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700'}`}><Icon size={18} aria-hidden="true" /></span>
              {tier.capacity > 0 && <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500"><User size={11} aria-hidden="true" />{tier.capacity}</span>}
            </span>
            <span className="mt-2 text-sm font-bold text-slate-900">{tier.label}</span>
            <span className="text-[11px] leading-4 text-slate-500">{category || preview ? tier.tagline : 'Not in your area yet'}</span>
            {showEstimate && estimate && (
              <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-teal-900">
                {estimating ? 'Pricing…' : estimate.amount !== null ? formatNaira(estimate.amount) : null}
                {!estimating && estimate.surge > 1 && <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] text-orange-800"><Flame size={10} aria-hidden="true" />{estimate.surge.toFixed(1)}x</span>}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
