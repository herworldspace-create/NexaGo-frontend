'use client'

import { useEffect, useState } from 'react'
import { BrandMark, BrandWordmark } from './brand-logo'

const VISIBLE_MS = 1700
const FADE_MS = 450

export function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'done'>('visible')

  useEffect(() => {
    const leave = window.setTimeout(() => setPhase('leaving'), VISIBLE_MS)
    const done = window.setTimeout(() => setPhase('done'), VISIBLE_MS + FADE_MS)
    return () => {
      window.clearTimeout(leave)
      window.clearTimeout(done)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      role="status"
      aria-label="Loading NexaGo"
      className={`fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-6 bg-teal-800 px-6 transition-opacity duration-[450ms] ease-out motion-reduce:transition-none ${phase === 'leaving' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="nexa-splash-in flex flex-col items-center gap-5">
        <span className="rounded-[34px] bg-white/10 p-1.5 shadow-2xl ring-1 ring-white/15">
          <BrandMark size="lg" />
        </span>
        <BrandWordmark size="lg" tone="light" />
        <p className="text-sm font-medium text-teal-100/80">Rides · Delivery · NexaPay</p>
      </div>
      <span className="absolute bottom-[max(env(safe-area-inset-bottom),40px)] h-1 w-24 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <span className="nexa-splash-bar block h-full w-1/2 rounded-full bg-orange-400" />
      </span>
    </div>
  )
}
