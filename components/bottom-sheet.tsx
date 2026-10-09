'use client'

import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'

type BottomSheetProps = {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}

export function BottomSheet({ title, description, children, onClose }: BottomSheetProps) {
  const titleId = useId()
  return (
    <div
      className="fixed inset-0 z-[1250] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={19} /></button>
        </div>
        {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
        {children}
      </section>
    </div>
  )
}
