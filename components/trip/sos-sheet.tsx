'use client'

import { Copy, Crosshair, MessageCircle, MessageSquare, PhoneCall, ShieldAlert, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { getAccessToken, listTrustedContacts, triggerSos } from '../../lib/api'
import { friendlyError } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'
import { isServiceNotLive } from '../service-unavailable'

type Coordinates = { latitude: number; longitude: number; accuracy?: number }
type GpsState = { status: 'locating' } | { status: 'ready'; coords: Coordinates } | { status: 'unavailable'; message: string }

function readGps(onResult: (state: GpsState) => void) {
  if (!navigator.geolocation) return onResult({ status: 'unavailable', message: 'Location isn’t available on this device.' })
  navigator.geolocation.getCurrentPosition(
    (position) => onResult({ status: 'ready', coords: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } }),
    (error) => onResult({ status: 'unavailable', message: error.code === error.PERMISSION_DENIED ? 'Allow location access so contacts can find you.' : 'Couldn’t get your location. Try again.' }),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
  )
}

type SosSheetProps = {
  rideId?: string
  tripSummary?: string
  onClose: () => void
}

export function SosSheet({ rideId, tripSummary, onClose }: SosSheetProps) {
  const [gps, setGps] = useState<GpsState>({ status: 'locating' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [error, setError] = useState('')
  const signedIn = Boolean(getAccessToken())
  const { data: contacts = [] } = useSWR(signedIn ? 'trusted-contacts' : null, listTrustedContacts, { shouldRetryOnError: false })

  useEffect(() => { readGps(setGps) }, [])

  const coords = gps.status === 'ready' ? gps.coords : null
  const mapsLink = coords ? `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}` : ''
  const alertText = [
    'EMERGENCY: I need help.',
    tripSummary ? `I'm on a NexaGo trip (${tripSummary}).` : '',
    rideId ? `Trip ID: ${rideId.slice(0, 8).toUpperCase()}.` : '',
    coords ? `My live location: ${mapsLink}` : 'I could not share my GPS location.',
  ].filter(Boolean).join(' ')
  const encoded = encodeURIComponent(alertText)
  const allNumbers = contacts.map((contact) => contact.phone).join(',')

  const sendNexaGoAlert = async () => {
    if (!rideId) return
    setStatus('sending')
    setError('')
    try {
      await triggerSos(rideId, coords)
      setStatus('sent')
    } catch (sosError) {
      setError(isServiceNotLive(sosError) ? 'The NexaGo safety desk isn’t reachable yet. Use the contact and 112 options below.' : friendlyError(sosError))
      setStatus('failed')
    }
  }

  return (
    <BottomSheet title="Emergency SOS" onClose={() => { if (status !== 'sending') onClose() }}>
      <a href="tel:112" className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 text-base font-bold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700">
        <PhoneCall size={20} aria-hidden="true" />Call 112 emergency line
      </a>

      <section aria-label="Your GPS location" className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${coords ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Crosshair size={17} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1" role="status">
            <p className="text-xs font-semibold text-slate-800">{coords ? 'Live GPS location' : gps.status === 'locating' ? 'Getting your GPS location…' : 'Location unavailable'}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">{coords ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}${coords.accuracy ? ` · ±${Math.round(coords.accuracy)}m` : ''}` : gps.status === 'unavailable' ? gps.message : 'This takes a few seconds'}</p>
          </div>
          {coords ? (
            <button type="button" onClick={() => void navigator.clipboard?.writeText(mapsLink)} aria-label="Copy location link" className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><Copy size={15} /></button>
          ) : gps.status === 'unavailable' ? (
            <button type="button" onClick={() => { setGps({ status: 'locating' }); readGps(setGps) }} className="text-xs font-bold text-teal-800">Retry</button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="sos-contacts-title" className="mt-4">
        <h3 id="sos-contacts-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">Alert your trusted contacts</h3>
        {contacts.length > 0 ? (
          <>
            <a href={`sms:${allNumbers}?body=${encoded}`} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-700">
              <MessageSquare size={17} aria-hidden="true" />Text all {contacts.length} contact{contacts.length > 1 ? 's' : ''} my location
            </a>
            <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{contact.name}</span><span className="text-xs text-slate-500">{contact.phone}</span></span>
                  <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} className="grid size-9 place-items-center rounded-full border border-slate-200 text-teal-800 hover:bg-teal-50"><PhoneCall size={15} /></a>
                  <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encoded}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${contact.name}`} className="grid size-9 place-items-center rounded-full border border-slate-200 text-emerald-700 hover:bg-emerald-50"><MessageCircle size={15} /></a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={`sms:?body=${encoded}`} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-300"><MessageSquare size={16} className="text-teal-700" aria-hidden="true" />Text location</a>
            <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-300"><MessageCircle size={16} className="text-emerald-600" aria-hidden="true" />WhatsApp</a>
            <p className="col-span-2 text-[11px] leading-4 text-slate-500">Add trusted contacts in your profile for one-tap alerts.</p>
          </div>
        )}
      </section>

      {rideId && (
        <div className="mt-4">
          {status === 'sent' ? (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-xs font-semibold text-emerald-800"><ShieldAlert size={16} aria-hidden="true" />NexaGo safety team alerted with your trip and location.</p>
          ) : (
            <button type="button" onClick={() => void sendNexaGoAlert()} disabled={status === 'sending'} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
              <Siren size={17} aria-hidden="true" />{status === 'sending' ? 'Alerting NexaGo…' : status === 'failed' ? 'Retry NexaGo safety alert' : 'Alert NexaGo safety team'}
            </button>
          )}
          {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
        </div>
      )}
    </BottomSheet>
  )
}
