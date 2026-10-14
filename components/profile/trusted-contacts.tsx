'use client'

import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { addTrustedContact, listTrustedContacts, removeTrustedContact } from '../../lib/api'
import { friendlyError, normalizeNigerianPhone } from '../../lib/format'
import { isServiceNotLive } from '../service-unavailable'

const MAX_CONTACTS = 5
const inputClass = 'h-11 min-w-0 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'

export function TrustedContacts() {
  const { data, error, isLoading, mutate } = useSWR('trusted-contacts', listTrustedContacts)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState('')
  const [formError, setFormError] = useState('')

  const contacts = data ?? []

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeNigerianPhone(phone)
    if (name.trim().length < 2) return setFormError('Enter the contact’s name.')
    if (!normalized) return setFormError('Use a Nigerian number like 0801 234 5678.')
    if (contacts.some((contact) => contact.phone === normalized)) return setFormError('This contact is already added.')
    setBusy('add')
    setFormError('')
    try {
      const created = await addTrustedContact({ name: name.trim(), phone: normalized })
      await mutate([...contacts, created], { revalidate: true })
      setName('')
      setPhone('')
      setAdding(false)
    } catch (addError) {
      setFormError(friendlyError(addError))
    } finally {
      setBusy('')
    }
  }

  const handleRemove = async (contactId: string) => {
    setBusy(contactId)
    try {
      await removeTrustedContact(contactId)
      await mutate(contacts.filter((contact) => contact.id !== contactId), { revalidate: false })
    } catch (removeError) {
      setFormError(friendlyError(removeError))
    } finally {
      setBusy('')
    }
  }

  return (
    <section aria-labelledby="trusted-contacts-title" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700"><ShieldCheck size={17} aria-hidden="true" /></span>
        <div>
          <h4 id="trusted-contacts-title" className="text-sm font-bold text-slate-900">Trusted contacts</h4>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">They’re alerted with your live location when you send an SOS.</p>
        </div>
      </div>

      {isServiceNotLive(error) ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">Trusted contacts are coming soon. SOS still alerts the NexaGo safety team.</p>
      ) : error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-800">{friendlyError(error)}</p>
      ) : isLoading ? (
        <p role="status" className="mt-3 text-xs text-slate-500">Loading contacts…</p>
      ) : (
        <>
          {contacts.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{contact.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{contact.name}</span><span className="block text-xs text-slate-500">{contact.phone}</span></span>
                  <button type="button" onClick={() => void handleRemove(contact.id)} disabled={busy === contact.id} aria-label={`Remove ${contact.name}`} className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
          {adding ? (
            <form onSubmit={(event) => void handleAdd(event)} className="mt-3 grid gap-2">
              <label className="sr-only" htmlFor="trusted-name">Contact name</label>
              <input id="trusted-name" autoFocus autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className={inputClass} />
              <label className="sr-only" htmlFor="trusted-phone">Contact phone</label>
              <input id="trusted-phone" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0801 234 5678" className={inputClass} />
              {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setAdding(false); setFormError('') }} className="h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={busy === 'add'} className="h-10 rounded-xl bg-teal-800 text-xs font-bold text-white disabled:opacity-60">{busy === 'add' ? 'Adding…' : 'Add contact'}</button>
              </div>
            </form>
          ) : (
            contacts.length < MAX_CONTACTS && <button type="button" onClick={() => setAdding(true)} className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-teal-400 hover:bg-teal-50"><Plus size={14} aria-hidden="true" />Add trusted contact</button>
          )}
          {!adding && formError && <p role="alert" className="mt-2 text-xs text-rose-700">{formError}</p>}
        </>
      )}
    </section>
  )
}
