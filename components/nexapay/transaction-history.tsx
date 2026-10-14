'use client'

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock3, Copy, Receipt, Search, Share2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { WalletTransaction } from '../../lib/api'
import { formatKobo, readNumber, readString } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'

type TxStatus = 'successful' | 'pending' | 'failed'
type Filter = 'all' | TxStatus

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'successful', label: 'Successful' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

const statusStyles: Record<TxStatus, { label: string; badge: string; icon: typeof CheckCircle2 }> = {
  successful: { label: 'Successful', badge: 'bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  pending: { label: 'Pending', badge: 'bg-amber-50 text-amber-800', icon: Clock3 },
  failed: { label: 'Failed', badge: 'bg-rose-50 text-rose-800', icon: XCircle },
}

function statusOf(transaction: WalletTransaction): TxStatus {
  const status = String(transaction.status ?? '').toUpperCase()
  if (/FAIL|REVERS|DECLIN|CANCEL|REJECT/.test(status)) return 'failed'
  if (/PEND|PROCESS|INITI|QUEUE|AWAIT/.test(status)) return 'pending'
  return 'successful'
}

function isCredit(transaction: WalletTransaction) {
  const marker = `${transaction.direction ?? ''} ${transaction.type ?? ''}`.toUpperCase()
  return marker.includes('CREDIT') || marker.includes('FUND') || marker.includes('REFUND') || marker.includes('INBOUND')
}

function titleOf(transaction: WalletTransaction) {
  return transaction.description || (transaction.type ? transaction.type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()) : 'Wallet transaction')
}

function dayGroup(dateValue: string): 'Today' | 'Yesterday' | 'Older' {
  const date = new Date(dateValue)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (date.getTime() >= startOfToday) return 'Today'
  if (date.getTime() >= startOfToday - 86_400_000) return 'Yesterday'
  return 'Older'
}

function referenceOf(transaction: WalletTransaction) {
  return readString(transaction, ['reference', 'referenceId', 'providerReference']) ?? transaction.id
}

export function TransactionHistory({ transactions, loading }: { transactions: WalletTransaction[]; loading: boolean }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<WalletTransaction | null>(null)

  const groups = useMemo(() => {
    const search = query.trim().toLowerCase()
    const visible = transactions
      .filter((transaction) => filter === 'all' || statusOf(transaction) === filter)
      .filter((transaction) => !search || `${titleOf(transaction)} ${referenceOf(transaction)} ${transaction.amountKobo / 100}`.toLowerCase().includes(search))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const grouped = new Map<string, WalletTransaction[]>()
    for (const transaction of visible) {
      const label = dayGroup(transaction.createdAt)
      grouped.set(label, [...(grouped.get(label) ?? []), transaction])
    }
    return [...grouped.entries()]
  }, [filter, query, transactions])

  return (
    <section aria-labelledby="history-title" className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="sticky top-[68px] z-10 rounded-t-3xl border-b border-slate-100 bg-white/95 p-4 backdrop-blur sm:p-5">
        <h2 id="history-title" className="text-base font-bold text-slate-900">Transaction history</h2>
        <label className="relative mt-3 block">
          <span className="sr-only">Search transactions</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, amount or reference" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10" />
        </label>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filter by status">
          {filters.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)} className="h-8 shrink-0 rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition aria-pressed:border-teal-800 aria-pressed:bg-teal-800 aria-pressed:text-white">{option.label}</button>
          ))}
        </div>
      </div>

      <div className="p-2 sm:p-3">
        {loading && transactions.length === 0 ? (
          <p role="status" className="p-6 text-center text-sm text-slate-500">Loading transactions…</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center p-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500"><Receipt size={20} aria-hidden="true" /></span>
            <p className="mt-3 text-sm font-semibold text-slate-800">{transactions.length ? 'No matching transactions' : 'No transactions yet'}</p>
            <p className="mt-1 text-xs text-slate-500">{transactions.length ? 'Try a different search or filter.' : 'Top-ups, rides and bill payments will appear here.'}</p>
          </div>
        ) : groups.map(([label, items]) => (
          <div key={label} className="mb-2">
            <h3 className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</h3>
            <ul>
              {items.map((transaction) => {
                const credit = isCredit(transaction)
                const status = statusStyles[statusOf(transaction)]
                return (
                  <li key={transaction.id}>
                    <button type="button" onClick={() => setSelected(transaction)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-slate-50">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${credit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{credit ? <ArrowDownLeft size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{titleOf(transaction)}</span>
                        <span className="block text-[11px] text-slate-500">{new Date(transaction.createdAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`text-sm font-bold ${credit ? 'text-emerald-700' : 'text-slate-900'}`}>{credit ? '+' : '−'}{formatKobo(Math.abs(transaction.amountKobo))}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.badge}`}>{status.label}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {selected && <ReceiptSheet transaction={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function ReceiptSheet({ transaction, onClose }: { transaction: WalletTransaction; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const credit = isCredit(transaction)
  const status = statusStyles[statusOf(transaction)]
  const StatusIcon = status.icon
  const reference = referenceOf(transaction)
  const balanceAfter = readNumber(transaction, ['balanceAfterKobo'])
  const rows: [string, string][] = [
    ['Transaction type', titleOf(transaction)],
    ['Date & time', new Date(transaction.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })],
    ['Direction', credit ? 'Money in' : 'Money out'],
    ...(balanceAfter !== undefined ? [['Balance after', formatKobo(balanceAfter)] as [string, string]] : []),
    ['Reference', reference],
  ]
  const receiptText = `NexaPay receipt\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\nAmount: ${formatKobo(Math.abs(transaction.amountKobo))}\nStatus: ${status.label}`

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const share = async () => {
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'NexaPay receipt', text: receiptText })
      else await navigator.clipboard.writeText(receiptText)
    } catch {
      // The user dismissed the share sheet.
    }
  }

  return (
    <BottomSheet title="Transaction receipt" onClose={onClose}>
      <div className="mt-4 flex flex-col items-center rounded-2xl bg-slate-50 px-4 py-6 text-center">
        <span className={`grid size-12 place-items-center rounded-full ${status.badge}`}><StatusIcon size={24} aria-hidden="true" /></span>
        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{credit ? '+' : '−'}{formatKobo(Math.abs(transaction.amountKobo))}</p>
        <span className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.badge}`}>{status.label}</span>
      </div>
      <dl className="mt-4 divide-y divide-dashed divide-slate-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="max-w-[60%] break-all text-right text-xs font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copyReference()} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"><Copy size={15} aria-hidden="true" />{copied ? 'Copied' : 'Copy reference'}</button>
        <button type="button" onClick={() => void share()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-800 text-xs font-bold text-white hover:bg-teal-900"><Share2 size={15} aria-hidden="true" />Share receipt</button>
      </div>
    </BottomSheet>
  )
}
