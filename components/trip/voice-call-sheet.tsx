'use client'

import { Lock, Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BottomSheet } from '../bottom-sheet'
import type { useTripCall } from './use-trip-call'

type TripCall = ReturnType<typeof useTripCall>

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const stateLabel: Record<TripCall['state'], string> = {
  idle: '',
  calling: 'Calling your driver…',
  ringing: 'Your driver is calling',
  connecting: 'Connecting securely…',
  connected: 'Connected',
  ended: 'Call ended',
  failed: 'Call unavailable',
}

export function VoiceCallSheet({ call, driverName }: { call: TripCall; driverName: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!call.connectedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [call.connectedAt])

  if (call.state === 'idle') return null
  const active = call.state === 'calling' || call.state === 'connecting' || call.state === 'connected'
  const close = active ? call.endCall : call.dismiss

  return (
    <BottomSheet title="In-app call" onClose={close}>
      <div className="flex flex-col items-center py-6 text-center">
        <span className={`grid size-20 place-items-center rounded-full bg-teal-800 text-2xl font-bold text-white ${call.state === 'calling' || call.state === 'ringing' ? 'animate-pulse' : ''}`}>{driverName.charAt(0).toUpperCase()}</span>
        <h3 className="mt-4 text-lg font-bold text-slate-900">{driverName}</h3>
        <p role="status" aria-live="polite" className="mt-1 text-sm text-slate-500">
          {call.state === 'connected' && call.connectedAt ? formatDuration(now - call.connectedAt) : stateLabel[call.state]}
        </p>
        {call.error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs leading-5 text-rose-800">{call.error}</p>}
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400"><Lock size={12} aria-hidden="true" /> Your phone number stays private. Calls run over the internet.</p>
      </div>

      <div className="flex items-center justify-center gap-5">
        {call.state === 'ringing' ? (
          <>
            <button type="button" onClick={call.endCall} aria-label="Decline call" className="grid size-16 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><PhoneOff size={24} /></button>
            <button type="button" onClick={() => void call.acceptCall()} aria-label="Accept call" className="grid size-16 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"><Phone size={24} /></button>
          </>
        ) : active ? (
          <>
            <button type="button" onClick={call.toggleMute} aria-pressed={call.muted} aria-label={call.muted ? 'Unmute microphone' : 'Mute microphone'} className="grid size-14 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 aria-pressed:bg-slate-900 aria-pressed:text-white">{call.muted ? <MicOff size={21} /> : <Mic size={21} />}</button>
            <button type="button" onClick={call.endCall} aria-label="End call" className="grid size-16 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><PhoneOff size={24} /></button>
          </>
        ) : (
          <button type="button" onClick={call.dismiss} className="h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Close</button>
        )}
      </div>
    </BottomSheet>
  )
}
