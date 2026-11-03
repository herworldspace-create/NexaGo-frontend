'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { BottomSheet } from '../bottom-sheet'

type SupportRequest = { category: string; description: string; reference: string }

export function SupportSheet({ initialReference = '', onClose }: { initialReference?: string; onClose: () => void }) {
  const [category, setCategory] = useState('payment')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState(initialReference)
  const [submitted, setSubmitted] = useState(false)
  const [requests, setRequests] = useState<SupportRequest[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('nexago_support_requests') || '[]') as SupportRequest[] } catch { return [] }
  })
  const mailto = `mailto:support@nexago.com?subject=${encodeURIComponent(`NexaGo ${category} support${reference ? `: ${reference}` : ''}`)}&body=${encodeURIComponent(`Hello NexaGo Support,\n\nIssue type: ${category}\nReference: ${reference || 'Not provided'}\n\n${description}`)}`
  return <BottomSheet title={submitted ? 'Support request prepared' : 'Help & report an issue'} onClose={onClose}>
    <p className="text-sm leading-6 text-slate-600">Describe the issue and include the trip or payment reference. This prepares a message for you; it does not submit a ticket or confirm a refund.</p>
    {!submitted ? <form onSubmit={(event) => { event.preventDefault(); const request = { category, description, reference }; const next = [request, ...requests].slice(0, 10); setRequests(next); try { window.localStorage.setItem('nexago_support_requests', JSON.stringify(next)) } catch { /* local history is optional */ } setSubmitted(true) }} className="mt-4 grid gap-3"><label className="text-xs font-semibold text-slate-700">Issue type<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="payment">Payment or refund</option><option value="ride">Ride or driver</option><option value="safety">Safety concern</option><option value="other">Other</option></select></label><label className="text-xs font-semibold text-slate-700">Ride or payment reference<input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Reference ID" /></label><label className="text-xs font-semibold text-slate-700">What happened?<textarea required minLength={8} value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Add details, but do not include your PIN or full card details." /></label><button type="submit" className="h-11 rounded-xl bg-teal-800 text-sm font-bold text-white">Save support draft</button></form> : <div className="mt-4 rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Review your message</h3><p className="mt-2 text-xs text-slate-500">Saved on this device only. NexaGo has not received it.</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{description}</p><a href={mailto} className="mt-4 block rounded-xl bg-teal-800 px-4 py-3 text-center text-sm font-bold text-white">Open email to support</a><button type="button" onClick={() => setSubmitted(false)} className="mt-3 w-full text-sm font-semibold text-teal-800">Edit message</button></div>}
    {requests.length > 0 && <section className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold text-slate-900">Recent saved drafts</h3><ul className="mt-2 grid gap-2">{requests.map((item,index)=><li key={`${item.reference}-${index}`} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span className="min-w-0 flex-1 truncate">{item.category} · {item.reference || 'No reference'}</span><button type="button" aria-label="Remove saved support draft" onClick={() => { const next=requests.filter((_,position)=>position!==index); setRequests(next); try{window.localStorage.setItem('nexago_support_requests',JSON.stringify(next))}catch{/* optional */} }}><X size={15}/></button></li>)}</ul></section>}
  </BottomSheet>
}
