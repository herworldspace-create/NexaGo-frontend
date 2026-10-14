'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

type BottomSheetProps = {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}

/** Closes the dialog on Escape wherever focus is, moves focus into it on open, and restores focus on close. */
export function useDialogDismiss(dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return
      event.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [dialogRef])
}

export function BottomSheet({ title, description, children, onClose }: BottomSheetProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  useDialogDismiss(dialogRef, onClose)

  return (
    <div
      className="fixed inset-0 z-[1250] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl outline-none sm:rounded-3xl sm:p-6">
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
