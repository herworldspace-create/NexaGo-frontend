'use client'

import { Copy, Link2, MessageCircle, MessageSquareText, Share2 } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'
import { createTripShareLink, listTrustedContacts } from '../../lib/api'
import { friendlyError } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'
import { isServiceNotLive } from '../service-unavailable'

type ShareTripSheetProps = {
  rideId: string
  pickupLabel: string
  dropoffLabel: string
  onClose: () => void
  onToast: (message: string) => void
}

export function ShareTripSheet({ rideId, pickupLabel, dropoffLabel, onClose, onToast }: ShareTripSheetProps) {
  const [link, setLink] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [linkUnavailable, setLinkUnavailable] = useState(false)
  const { data: contacts = [] } = useSWR('trusted-contacts', () => listTrustedContacts(), { shouldRetryOnError: false })

  const message = `I’m on a NexaGo ride (trip ${rideId.slice(0, 8).toUpperCase()}) from ${pickupLabel} to ${dropoffLabel || 'my destination'}.${link ? ` Follow my trip live: ${link}` : ''}`

  const createLink = async () => {
    setCreating(true)
    setError('')
    try {
      const result = await createTripShareLink(rideId)
      setLink(result.url)
    } catch (shareError) {
      if (isServiceNotLive(shareError)) setLinkUnavailable(true)
      else setError(friendlyError(shareError))
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      onToast('Trip details copied.')
    } catch {
      onToast('Copy is unavailable in this browser.')
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'My NexaGo trip', text: message })
    } catch {
      // Dismissing the system share sheet rejects; nothing to recover.
    }
  }

  const encoded = encodeURIComponent(message)

  return (
    <BottomSheet title="Share your trip" description="Let someone you trust follow your ride until you arrive." onClose={onClose}>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800"><Link2 size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Secure live link</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{link ? link : linkUnavailable ? 'Live links aren’t enabled on the server yet. You can still share your trip details.' : 'Expires automatically when your trip ends.'}</p>
          </div>
        </div>
        {!link && !linkUnavailable && <button type="button" onClick={() => void createLink()} disabled={creating} className="mt-3 h-10 w-full rounded-xl bg-teal-800 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-60">{creating ? 'Creating secure link…' : 'Create live link'}</button>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-semibold text-slate-700 hover:border-teal-300"><MessageCircle size={20} className="text-emerald-600" aria-hidden="true" />WhatsApp</a>
        <a href={`sms:?&body=${encoded}`} className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-semibold text-slate-700 hover:border-teal-300"><MessageSquareText size={20} className="text-teal-700" aria-hidden="true" />SMS</a>
        <button type="button" onClick={() => void copy()} className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-semibold text-slate-700 hover:border-teal-300"><Copy size={20} className="text-slate-600" aria-hidden="true" />Copy</button>
      </div>
      {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" onClick={() => void nativeShare()} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Share2 size={15} aria-hidden="true" />More sharing options</button>}

      {contacts.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold text-slate-800">Trusted contacts</h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{contact.name}</span><span className="block text-[11px] text-slate-500">{contact.phone}</span></span>
                <a href={`sms:${contact.phone}?&body=${encoded}`} className="h-9 shrink-0 rounded-lg bg-teal-50 px-3 text-xs font-bold leading-9 text-teal-800 hover:bg-teal-100">Send</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  )
}
