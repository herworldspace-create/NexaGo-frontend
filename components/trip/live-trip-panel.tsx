'use client'

import { KeyRound, MessageCircle, Phone, Share2, Siren, SplitSquareHorizontal } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import useSWR from 'swr'
import { getRidePinSettings, type TripMessage } from '../../lib/api'
import { formatNaira } from '../../lib/format'
import { ShareTripSheet } from './share-trip-sheet'
import { SosSheet } from './sos-sheet'
import { SplitFareSheet } from './split-fare-sheet'
import { TripChatSheet } from './trip-chat-sheet'
import { useTripCall } from './use-trip-call'
import { VoiceCallSheet } from './voice-call-sheet'

export type LiveConnection = 'connecting' | 'live' | 'polling'

type LiveTripPanelProps = {
  rideId: string
  status: 'searching' | 'accepted'
  connection: LiveConnection
  socket: Socket | null
  currentUserId?: string
  fareAmount: number | null
  tierLabel?: string
  pickupLabel: string
  dropoffLabel: string
  hasDriverLocation: boolean
  onToast: (message: string) => void
}

type Panel = 'chat' | 'share' | 'split' | 'sos' | null

function ActionButton({ label, icon, onClick, badge, disabled }: { label: string; icon: ReactNode; onClick: () => void; badge?: number; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-[11px] font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-45">
      {icon}
      {label}
      {badge ? <span className="absolute right-2 top-2 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-4 text-white">{badge}</span> : null}
    </button>
  )
}

export function LiveTripPanel(props: LiveTripPanelProps) {
  const { rideId, status, connection, socket, currentUserId, fareAmount, tierLabel, onToast } = props
  const [panel, setPanel] = useState<Panel>(null)
  const [unread, setUnread] = useState(0)
  const call = useTripCall(socket, rideId)
  const { data: ridePin } = useSWR('ride-pin', () => getRidePinSettings(), { shouldRetryOnError: false })
  const driverAssigned = status === 'accepted'

  useEffect(() => {
    if (!socket || panel === 'chat') return
    const onMessage = (message: TripMessage) => {
      if (message.rideId !== rideId || message.senderUserId === currentUserId) return
      setUnread((count) => count + 1)
      onToast('New message from your driver.')
    }
    socket.on('chat:message', onMessage)
    return () => { socket.off('chat:message', onMessage) }
  }, [currentUserId, onToast, panel, rideId, socket])

  const openChat = () => {
    setUnread(0)
    setPanel('chat')
  }

  return (
    <section aria-label="Active trip" className="mb-4 overflow-hidden rounded-3xl border border-teal-900/10 bg-white shadow-sm">
      <div className="bg-teal-800 px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-teal-100/80">{tierLabel ?? 'NexaGo'} · Trip {rideId.slice(0, 8).toUpperCase()}</p>
            <h2 className="mt-1 text-lg font-bold">{driverAssigned ? 'Your driver is on the way' : 'Finding you a driver…'}</h2>
            <p className="mt-0.5 truncate text-xs text-teal-50/80">{props.pickupLabel} → {props.dropoffLabel || 'Destination'}</p>
          </div>
          <span role="status" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold">
            <span className={`size-1.5 rounded-full ${connection === 'live' ? 'animate-pulse bg-emerald-300' : 'bg-amber-300'}`} aria-hidden="true" />
            {connection === 'live' ? 'Live GPS' : connection === 'polling' ? 'Updating every 5s' : 'Connecting'}
          </span>
        </div>
        {fareAmount !== null && <p className="mt-3 text-2xl font-bold">{formatNaira(fareAmount)}</p>}
        {driverAssigned && !props.hasDriverLocation && <p className="mt-1 text-[11px] text-teal-50/80">Waiting for your driver’s first GPS fix…</p>}
      </div>

      <div className="flex flex-col gap-3 p-4">
        {ridePin?.enabled && ridePin.pin && (
          <p className="flex items-center gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
            <KeyRound size={16} className="shrink-0" aria-hidden="true" />
            <span>Share ride PIN <strong className="font-mono text-sm tracking-[.25em]">{ridePin.pin}</strong> with your driver only after you’ve checked the plate number.</span>
          </p>
        )}
        <div className="grid grid-cols-4 gap-2">
          <ActionButton label="Chat" icon={<MessageCircle size={19} className="text-teal-700" aria-hidden="true" />} onClick={openChat} badge={unread} disabled={!driverAssigned} />
          <ActionButton label="Call" icon={<Phone size={19} className="text-teal-700" aria-hidden="true" />} onClick={() => void call.startCall()} disabled={!driverAssigned || call.state !== 'idle'} />
          <ActionButton label="Share" icon={<Share2 size={19} className="text-teal-700" aria-hidden="true" />} onClick={() => setPanel('share')} />
          <ActionButton label="Split" icon={<SplitSquareHorizontal size={19} className="text-teal-700" aria-hidden="true" />} onClick={() => setPanel('split')} />
        </div>
        <button type="button" onClick={() => setPanel('sos')} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700">
          <Siren size={18} aria-hidden="true" />SOS · Emergency help
        </button>
      </div>

      <audio ref={call.remoteAudioRef} autoPlay className="hidden" />
      <VoiceCallSheet call={call} driverName="Your driver" />
      {panel === 'chat' && <TripChatSheet rideId={rideId} socket={socket} currentUserId={currentUserId} onClose={() => setPanel(null)} />}
      {panel === 'share' && <ShareTripSheet rideId={rideId} pickupLabel={props.pickupLabel} dropoffLabel={props.dropoffLabel} onClose={() => setPanel(null)} onToast={onToast} />}
      {panel === 'split' && <SplitFareSheet rideId={rideId} fareAmount={fareAmount} onClose={() => setPanel(null)} onToast={onToast} />}
      {panel === 'sos' && <SosSheet rideId={rideId} onClose={() => setPanel(null)} />}
    </section>
  )
}
