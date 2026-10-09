'use client'

import { Briefcase, CalendarClock, MapPinPlus, X, Zap } from 'lucide-react'
import useSWR from 'swr'
import { listBusinessProfiles, type RideLocation } from '../../lib/api'

export const MAX_STOPS = 3

export type TripMode = 'now' | 'scheduled'

type TripOptionsProps = {
  signedIn: boolean
  mode: TripMode
  onModeChange: (mode: TripMode) => void
  scheduledFor: string
  onScheduledForChange: (value: string) => void
  businessProfileId: string
  onBusinessProfileChange: (id: string) => void
  stops: RideLocation[]
  addingStop: boolean
  onAddStop: () => void
  onRemoveStop: (index: number) => void
}

function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TripOptions(props: TripOptionsProps) {
  const { data: businessProfiles = [] } = useSWR(props.signedIn ? 'business-profiles' : null, () => listBusinessProfiles(), { shouldRetryOnError: false })
  const now = new Date()
  const minSchedule = toLocalInputValue(new Date(now.getTime() + 15 * 60_000))
  const maxSchedule = toLocalInputValue(new Date(now.getTime() + 30 * 24 * 60 * 60_000))

  return (
    <div className="mt-3 flex flex-col gap-3">
      {props.stops.length > 0 && (
        <ol aria-label="Stops" className="flex flex-col gap-1.5">
          {props.stops.map((stop, index) => (
            <li key={`${stop.latitude}-${stop.longitude}`} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{stop.address}</span>
              <button type="button" onClick={() => props.onRemoveStop(index)} aria-label={`Remove stop ${index + 1}`} className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-slate-700"><X size={14} /></button>
            </li>
          ))}
        </ol>
      )}
      {props.stops.length < MAX_STOPS && (
        <button type="button" onClick={props.onAddStop} aria-pressed={props.addingStop} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 transition hover:border-teal-400 hover:bg-teal-50 aria-pressed:border-teal-600 aria-pressed:bg-teal-50 aria-pressed:text-teal-800">
          <MapPinPlus size={15} aria-hidden="true" />{props.addingStop ? `Tap the map to place stop ${props.stops.length + 1}` : 'Add a stop'}
        </button>
      )}

      <div role="radiogroup" aria-label="When do you need this ride?" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {([['now', 'Ride now', Zap], ['scheduled', 'Schedule', CalendarClock]] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" role="radio" aria-checked={props.mode === value} onClick={() => props.onModeChange(value)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-slate-500 transition aria-checked:bg-white aria-checked:text-teal-800 aria-checked:shadow-sm">
            <Icon size={14} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      {props.mode === 'scheduled' && (
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          Pickup date and time
          <input type="datetime-local" required value={props.scheduledFor} min={minSchedule} max={maxSchedule} onChange={(event) => props.onScheduledForChange(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" />
          <span className="font-normal text-slate-500">Book at least 15 minutes ahead, up to 30 days.</span>
        </label>
      )}

      {businessProfiles.length > 0 && (
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5"><Briefcase size={13} aria-hidden="true" />Bill this trip to</span>
          <select value={props.businessProfileId} onChange={(event) => props.onBusinessProfileChange(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600">
            <option value="">Personal (NexaPay)</option>
            {businessProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · Corporate</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
