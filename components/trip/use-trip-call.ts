'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'failed'

type SignalPayload = {
  rideId?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

const iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
const RING_TIMEOUT_MS = 35_000

async function flushCandidates(peer: RTCPeerConnection, queue: RTCIceCandidateInit[]) {
  while (queue.length) {
    const candidate = queue.shift()
    if (candidate) await peer.addIceCandidate(candidate).catch(() => undefined)
  }
}

function describeMediaError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Microphone access was blocked. Allow it in your browser settings to call.'
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No microphone was found on this device.'
  return error instanceof Error ? error.message : 'The call could not be started.'
}

/**
 * Peer-to-peer WebRTC audio between rider and driver. Signaling (offer, answer,
 * ICE, end) is relayed through the trip's realtime socket room, so neither
 * party ever sees the other's phone number.
 */
export function useTripCall(socket: Socket | null, rideId: string) {
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const ringTimeoutRef = useRef<number | null>(null)

  const teardown = useCallback((next: CallState) => {
    if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current)
    ringTimeoutRef.current = null
    peerRef.current?.close()
    peerRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    pendingOfferRef.current = null
    pendingCandidatesRef.current = []
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setMuted(false)
    setConnectedAt(null)
    setState(next)
  }, [])

  const createPeer = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('In-app calling is not supported in this browser.')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    localStreamRef.current = stream
    const peer = new RTCPeerConnection({ iceServers })
    stream.getTracks().forEach((track) => peer.addTrack(track, stream))
    peer.onicecandidate = (event) => {
      if (event.candidate) socket?.emit('call:ice', { rideId, candidate: event.candidate.toJSON() })
    }
    peer.ontrack = (event) => {
      const audio = remoteAudioRef.current
      if (!audio) return
      audio.srcObject = event.streams[0]
      void audio.play().catch(() => undefined)
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setState('connected')
        setConnectedAt(Date.now())
      } else if (peer.connectionState === 'failed') {
        setError('The call connection dropped. Try calling again.')
        teardown('failed')
      }
    }
    peerRef.current = peer
    return peer
  }, [rideId, socket, teardown])

  const startCall = useCallback(async () => {
    if (!socket?.connected) {
      setError('In-app calling needs a live connection. Check your internet and try again.')
      setState('failed')
      return
    }
    setError('')
    setState('calling')
    try {
      const peer = await createPeer()
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      socket.emit('call:offer', { rideId, sdp: offer })
      ringTimeoutRef.current = window.setTimeout(() => {
        socket.emit('call:end', { rideId, reason: 'NO_ANSWER' })
        setError('Your driver didn’t answer. Try again or send a chat message.')
        teardown('failed')
      }, RING_TIMEOUT_MS)
    } catch (callError) {
      setError(describeMediaError(callError))
      teardown('failed')
    }
  }, [createPeer, rideId, socket, teardown])

  const acceptCall = useCallback(async () => {
    const offer = pendingOfferRef.current
    if (!offer || !socket) return
    setState('connecting')
    try {
      const peer = await createPeer()
      await peer.setRemoteDescription(offer)
      await flushCandidates(peer, pendingCandidatesRef.current)
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      socket.emit('call:answer', { rideId, sdp: answer })
    } catch (callError) {
      socket.emit('call:end', { rideId })
      setError(describeMediaError(callError))
      teardown('failed')
    }
  }, [createPeer, rideId, socket, teardown])

  const endCall = useCallback(() => {
    socket?.emit('call:end', { rideId })
    teardown('ended')
  }, [rideId, socket, teardown])

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = current })
      return !current
    })
  }, [])

  const dismiss = useCallback(() => {
    setError('')
    setState('idle')
  }, [])

  useEffect(() => {
    if (!socket) return
    const onOffer = (payload: SignalPayload) => {
      if (payload.rideId !== rideId || !payload.sdp || peerRef.current) return
      pendingOfferRef.current = payload.sdp
      setError('')
      setState('ringing')
    }
    const onAnswer = async (payload: SignalPayload) => {
      const peer = peerRef.current
      if (payload.rideId !== rideId || !payload.sdp || !peer) return
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current)
      setState('connecting')
      await peer.setRemoteDescription(payload.sdp)
      await flushCandidates(peer, pendingCandidatesRef.current)
    }
    const onIce = async (payload: SignalPayload) => {
      if (payload.rideId !== rideId || !payload.candidate) return
      const peer = peerRef.current
      if (!peer?.remoteDescription) {
        pendingCandidatesRef.current.push(payload.candidate)
        return
      }
      await peer.addIceCandidate(payload.candidate).catch(() => undefined)
    }
    const onEnd = (payload: SignalPayload) => {
      if (payload.rideId === rideId) teardown('ended')
    }
    socket.on('call:offer', onOffer)
    socket.on('call:answer', onAnswer)
    socket.on('call:ice', onIce)
    socket.on('call:end', onEnd)
    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:answer', onAnswer)
      socket.off('call:ice', onIce)
      socket.off('call:end', onEnd)
    }
  }, [rideId, socket, teardown])

  useEffect(() => () => teardown('idle'), [teardown])

  return { state, error, muted, connectedAt, remoteAudioRef, startCall, acceptCall, endCall, toggleMute, dismiss }
}
