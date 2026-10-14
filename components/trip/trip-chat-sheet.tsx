'use client'

import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import useSWR from 'swr'
import { listTripMessages, sendTripMessage, type TripMessage } from '../../lib/api'
import { friendlyError } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'
import { isServiceNotLive, ServiceUnavailable } from '../service-unavailable'

const quickReplies = ['I’m at the pickup point', 'Running 2 minutes late', 'Please wait for me', 'Where are you now?']

type TripChatSheetProps = {
  rideId: string
  socket: Socket | null
  currentUserId?: string
  onClose: () => void
}

export function TripChatSheet({ rideId, socket, currentUserId, onClose }: TripChatSheetProps) {
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const live = Boolean(socket?.connected)
  const { data: messages = [], error, isLoading, mutate } = useSWR(['trip-messages', rideId], () => listTripMessages(rideId), {
    refreshInterval: live ? 0 : 5000,
  })

  useEffect(() => {
    if (!socket) return
    const onMessage = (message: TripMessage) => {
      if (message.rideId !== rideId) return
      void mutate((current = []) => current.some((item) => item.id === message.id) ? current : [...current, message], { revalidate: false })
    }
    socket.on('chat:message', onMessage)
    return () => { socket.off('chat:message', onMessage) }
  }, [mutate, rideId, socket])

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const send = async (text: string) => {
    const body = text.trim()
    if (!body) return
    setSendError('')
    setDraft('')
    const optimistic: TripMessage = { id: `pending-${Date.now()}`, rideId, senderUserId: currentUserId ?? 'me', body, createdAt: new Date().toISOString() }
    await mutate(async (current = []) => {
      const saved = await sendTripMessage(rideId, body)
      return [...current.filter((item) => item.id !== saved.id), saved]
    }, {
      optimisticData: (current = []) => [...current, optimistic],
      rollbackOnError: true,
      revalidate: false,
    }).catch((sendFailure: unknown) => {
      setDraft(body)
      setSendError(friendlyError(sendFailure))
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send(draft)
  }

  if (error && isServiceNotLive(error)) {
    return (
      <BottomSheet title="Chat with your driver" onClose={onClose}>
        <ServiceUnavailable title="In-app chat is almost here" description="Trip messaging is waiting on the NexaGo server. Use in-app calling to reach your driver for now." />
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Chat with your driver" description="Messages stay inside this trip. Your phone number is never shared." onClose={onClose}>
      <div className="mt-4 flex h-[46dvh] min-h-64 flex-col rounded-2xl border border-slate-200 bg-slate-50">
        <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
          {isLoading && <li className="m-auto text-xs text-slate-500">Loading conversation…</li>}
          {!isLoading && messages.length === 0 && <li className="m-auto max-w-56 text-center text-xs leading-5 text-slate-500">Say hello or send a quick reply to let your driver know where you are.</li>}
          {messages.map((message) => {
            const mine = message.senderUserId === currentUserId || message.id.startsWith('pending-')
            return (
              <li key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-5 ${mine ? 'rounded-br-md bg-teal-800 text-white' : 'rounded-bl-md bg-white text-slate-800 shadow-sm'}`}>{message.body}</span>
                <span className="mt-1 text-[10px] text-slate-400">{message.id.startsWith('pending-') ? 'Sending…' : new Date(message.createdAt).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            )
          })}
        </ol>
        <div className="flex gap-2 overflow-x-auto border-t border-slate-200 px-3 py-2">
          {quickReplies.map((reply) => <button key={reply} type="button" onClick={() => void send(reply)} className="h-8 shrink-0 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:border-teal-300">{reply}</button>)}
        </div>
      </div>
      {(sendError || (error && !isServiceNotLive(error))) && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">{sendError || friendlyError(error)}</p>}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <label htmlFor="trip-chat-input" className="sr-only">Message your driver</label>
        <input
          id="trip-chat-input"
          value={draft}
          maxLength={500}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}
          placeholder="Type a message"
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send message" className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-40"><SendHorizontal size={18} /></button>
      </form>
      <p className="mt-2 text-center text-[10px] text-slate-400">{live ? 'Live messaging connected' : 'Reconnecting… messages refresh every 5 seconds'}</p>
    </BottomSheet>
  )
}
