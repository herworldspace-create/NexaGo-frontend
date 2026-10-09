import { Clock } from 'lucide-react'
import { ApiError } from '../lib/api'

export function isServiceNotLive(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 501)
}

export function ServiceUnavailable({ title, description }: { title: string; description: string }) {
  return (
    <div role="status" className="my-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-teal-800 shadow-sm"><Clock size={20} aria-hidden="true" /></span>
      <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-slate-500">{description}</p>
      <span className="mt-4 inline-block rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-800">Coming soon</span>
    </div>
  )
}
