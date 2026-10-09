'use client'

import { Briefcase, Home, Trash2 } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'
import { listSavedPlaces, removeSavedPlace } from '../../lib/api'
import { friendlyError } from '../../lib/format'
import { isServiceNotLive } from '../service-unavailable'

export function SavedPlacesList() {
  const { data, error, isLoading, mutate } = useSWR('saved-places', listSavedPlaces)
  const [removing, setRemoving] = useState('')
  const [removeError, setRemoveError] = useState('')

  if (isServiceNotLive(error)) return null

  const places = data ?? []

  const handleRemove = async (placeId: string) => {
    setRemoving(placeId)
    setRemoveError('')
    try {
      await removeSavedPlace(placeId)
      await mutate(places.filter((place) => place.id !== placeId), { revalidate: false })
    } catch (failure) {
      setRemoveError(friendlyError(failure))
    } finally {
      setRemoving('')
    }
  }

  return (
    <section aria-labelledby="saved-places-title" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 id="saved-places-title" className="text-sm font-bold text-slate-900">Saved places</h4>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-700">{friendlyError(error)}</p>
      ) : isLoading ? (
        <p role="status" className="mt-2 text-xs text-slate-500">Loading places…</p>
      ) : places.length === 0 ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">Save Home or Work from the ride screen to book faster.</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {places.map((place) => {
            const Icon = place.label === 'WORK' ? Briefcase : Home
            return (
              <li key={place.id} className="flex items-center gap-3 rounded-xl p-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800"><Icon size={15} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold capitalize text-slate-800">{place.label.toLowerCase()}</span><span className="block truncate text-xs text-slate-500">{place.address}</span></span>
                <button type="button" onClick={() => void handleRemove(place.id)} disabled={removing === place.id} aria-label={`Remove ${place.label.toLowerCase()} place`} className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 size={15} /></button>
              </li>
            )
          })}
        </ul>
      )}
      {removeError && <p role="alert" className="mt-2 text-xs text-rose-700">{removeError}</p>}
    </section>
  )
}
