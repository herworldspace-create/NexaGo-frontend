'use client'

import { Layers, LocateFixed } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MapCoordinate, NexaGoMapProps } from '../lib/map-types'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const GOOGLE_SCRIPT_ID = 'nexago-google-maps'

/* ------------------------------------------------------------------ *
 * Minimal structural typings for the Maps JavaScript API.
 *
 * We deliberately avoid a runtime SDK dependency: a ~3 KB loader covers the
 * handful of primitives this screen needs, keeps the pnpm lockfile untouched,
 * and means a Google outage or missing key degrades to the OSM fallback instead
 * of breaking the build.
 * ------------------------------------------------------------------ */

type LatLngLiteral = { lat: number; lng: number }

type GoogleMap = {
  panTo(position: LatLngLiteral): void
  setZoom(zoom: number): void
  getZoom(): number | undefined
  fitBounds(bounds: GoogleBounds, padding?: Record<string, number>): void
  setMapTypeId(mapTypeId: string): void
  addListener(
    event: string,
    handler: (event: { latLng?: { lat(): number; lng(): number } }) => void,
  ): { remove(): void }
}

type GoogleBounds = { extend(position: LatLngLiteral): void }

type GoogleMarker = {
  setMap(map: GoogleMap | null): void
  setPosition(position: LatLngLiteral): void
}

type GooglePolyline = {
  setMap(map: GoogleMap | null): void
  setPath(path: LatLngLiteral[]): void
}

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap
  Marker: new (options: Record<string, unknown>) => GoogleMarker
  Polyline: new (options: Record<string, unknown>) => GooglePolyline
  LatLngBounds: new () => GoogleBounds
}

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace }
  }
}

let mapsLoader: Promise<GoogleMapsNamespace> | null = null

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'))
  }
  const existing = window.google?.maps
  if (existing) return Promise.resolve(existing)
  if (mapsLoader) return mapsLoader

  mapsLoader = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`
    script.onload = () => {
      const maps = window.google?.maps
      if (maps) resolve(maps)
      else reject(new Error('Google Maps loaded without the maps namespace.'))
    }
    script.onerror = () => {
      mapsLoader = null
      reject(new Error('Google Maps could not load. Check the key, billing and allowed referrers.'))
    }
    document.head.appendChild(script)
  })

  return mapsLoader
}

const circleIcon = (fill: string, stroke: string, scale: number) => ({
  // SymbolPath.CIRCLE === 0. Literal objects are accepted for Size/Point.
  path: 0,
  scale,
  fillColor: fill,
  fillOpacity: 1,
  strokeColor: stroke,
  strokeWeight: 3,
})

const PICKUP_ICON = circleIcon('#0f172a', '#ffffff', 8)
const DROPOFF_ICON = circleIcon('#84cc16', '#0f172a', 8)
const STOP_ICON = circleIcon('#334155', '#ffffff', 6)
const DRIVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34"><circle cx="12" cy="12" r="11" fill="#0f172a" stroke="#ffffff" stroke-width="2"/><path d="M6 13l1.6-4.2A1.5 1.5 0 0 1 9 8h6a1.5 1.5 0 0 1 1.4.8L18 13v3.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V16H8v.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V13z" fill="#a3e635"/><circle cx="8.5" cy="14" r=".9" fill="#0f172a"/><circle cx="15.5" cy="14" r=".9" fill="#0f172a"/></svg>`
const DRIVER_ICON = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(DRIVER_SVG)}`,
  scaledSize: { width: 34, height: 34 },
  anchor: { x: 17, y: 17 },
}

const DRIVER_ANIMATION_MS = 1200
const DEFAULT_CENTER: LatLngLiteral = { lat: 12.9908, lng: 7.6018 }

function GoogleNexaMap({
  apiKey,
  pickup,
  dropoff,
  stops = [],
  routePath = [],
  driverLocation,
  followDriver = false,
  onChooseDropoff,
  showControls = true,
}: NexaGoMapProps & { apiKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleMap | null>(null)
  const mapsRef = useRef<GoogleMapsNamespace | null>(null)
  const pickupMarker = useRef<GoogleMarker | null>(null)
  const dropoffMarker = useRef<GoogleMarker | null>(null)
  const stopMarkers = useRef<GoogleMarker[]>([])
  const driverMarker = useRef<GoogleMarker | null>(null)
  const driverFrom = useRef<MapCoordinate | null>(null)
  const routeLine = useRef<GooglePolyline | null>(null)
  const clickHandler = useRef(onChooseDropoff)
  clickHandler.current = onChooseDropoff

  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [satellite, setSatellite] = useState(false)

  // Create the map exactly once per key.
  useEffect(() => {
    let cancelled = false

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        mapsRef.current = maps
        const map = new maps.Map(containerRef.current, {
          center: pickup
            ? { lat: pickup.latitude, lng: pickup.longitude }
            : DEFAULT_CENTER,
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        })
        map.addListener('click', (event) => {
          const latLng = event.latLng
          if (latLng) clickHandler.current?.({ latitude: latLng.lat(), longitude: latLng.lng() })
        })
        mapRef.current = map
        setReady(true)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Google Maps could not load.')
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  // Pickup + drop-off pins.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    if (pickup) {
      const position = { lat: pickup.latitude, lng: pickup.longitude }
      if (pickupMarker.current) pickupMarker.current.setPosition(position)
      else
        pickupMarker.current = new maps.Marker({
          map,
          position,
          icon: PICKUP_ICON,
          title: 'Pickup',
          zIndex: 10,
        })
    } else {
      pickupMarker.current?.setMap(null)
      pickupMarker.current = null
    }

    if (dropoff) {
      const position = { lat: dropoff.latitude, lng: dropoff.longitude }
      if (dropoffMarker.current) dropoffMarker.current.setPosition(position)
      else
        dropoffMarker.current = new maps.Marker({
          map,
          position,
          icon: DROPOFF_ICON,
          title: 'Drop-off',
          zIndex: 12,
        })
    } else {
      dropoffMarker.current?.setMap(null)
      dropoffMarker.current = null
    }
  }, [ready, pickup, dropoff])

  // Stops (few enough to rebuild whenever the list changes).
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    for (const marker of stopMarkers.current) marker.setMap(null)
    stopMarkers.current = stops.map(
      (stop, index) =>
        new maps.Marker({
          map,
          position: { lat: stop.latitude, lng: stop.longitude },
          icon: STOP_ICON,
          title: `Stop ${index + 1}`,
          zIndex: 8,
        }),
    )
  }, [ready, stops])

  // Route polyline.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const path = routePath.map((point) => ({ lat: point.latitude, lng: point.longitude }))
    if (path.length > 1) {
      if (routeLine.current) routeLine.current.setPath(path)
      else
        routeLine.current = new maps.Polyline({
          map,
          path,
          strokeColor: '#84cc16',
          strokeOpacity: 0.95,
          strokeWeight: 6,
          zIndex: 5,
        })
    } else {
      routeLine.current?.setMap(null)
      routeLine.current = null
    }
  }, [ready, routePath])

  // Driver marker with eased movement between GPS fixes.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    if (!driverLocation) {
      driverMarker.current?.setMap(null)
      driverMarker.current = null
      return
    }

    if (!driverMarker.current) {
      driverMarker.current = new maps.Marker({
        map,
        position: { lat: driverLocation.latitude, lng: driverLocation.longitude },
        icon: DRIVER_ICON,
        title: 'Your driver',
        zIndex: 20,
      })
      driverFrom.current = { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
      return
    }

    const marker = driverMarker.current
    const target = { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    const origin = driverFrom.current ?? target
    driverFrom.current = target

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      marker.setPosition({ lat: target.latitude, lng: target.longitude })
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DRIVER_ANIMATION_MS)
      const eased = 1 - (1 - progress) ** 3
      marker.setPosition({
        lat: origin.latitude + (target.latitude - origin.latitude) * eased,
        lng: origin.longitude + (target.longitude - origin.longitude) * eased,
      })
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [ready, driverLocation])

  // Camera: follow the driver during a trip, otherwise frame the whole route.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    if (followDriver && driverLocation) {
      map.panTo({ lat: driverLocation.latitude, lng: driverLocation.longitude })
      return
    }

    const points = [pickup, dropoff, ...stops].filter((point): point is MapCoordinate => Boolean(point))
    if (points.length === 0) return
    if (points.length === 1) {
      map.panTo({ lat: points[0].latitude, lng: points[0].longitude })
      if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
      return
    }

    const bounds = new maps.LatLngBounds()
    for (const point of points) bounds.extend({ lat: point.latitude, lng: point.longitude })
    map.fitBounds(bounds, { top: 150, right: 60, bottom: 320, left: 60 })
  }, [ready, pickup, dropoff, stops, followDriver, driverLocation])

  const recenter = useCallback(() => {
    const map = mapRef.current
    if (!map || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.panTo({ lat: position.coords.latitude, lng: position.coords.longitude })
        map.setZoom(16)
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 },
    )
  }, [])

  const toggleLayers = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const next = !satellite
    map.setMapTypeId(next ? 'hybrid' : 'roadmap')
    setSatellite(next)
  }, [satellite])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Interactive ride map" role="application" />

      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#e8eee6]">
          <p className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow">
            Loading map…
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 top-1/3 rounded-2xl bg-white/95 p-4 text-center shadow-lg">
          <p className="text-sm font-bold text-slate-900">Map unavailable</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{error}</p>
        </div>
      )}

      {showControls && (
        <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+150px)] z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={recenter}
            aria-label="Recenter on my location"
            className="grid size-11 place-items-center rounded-2xl border border-slate-200/80 bg-white/95 text-slate-800 shadow-lg backdrop-blur transition active:scale-95"
          >
            <LocateFixed size={18} />
          </button>
          <button
            type="button"
            onClick={toggleLayers}
            aria-label={satellite ? 'Switch to standard map' : 'Switch to satellite map'}
            aria-pressed={satellite}
            className={`grid size-11 place-items-center rounded-2xl border shadow-lg backdrop-blur transition active:scale-95 ${
              satellite
                ? 'border-[#0f172a] bg-[#0f172a] text-[#a3e635]'
                : 'border-slate-200/80 bg-white/95 text-slate-800'
            }`}
          >
            <Layers size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

const LeafletFallback = dynamic(() => import('./nexago-map-leaflet'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e8eee6]" />,
})

/**
 * Public entry point. Google Maps renders when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is configured; otherwise the Leaflet/OpenStreetMap fallback keeps local
 * development, previews and key-less CI builds fully functional.
 */
export function NexaGoMap(props: NexaGoMapProps) {
  if (!GOOGLE_MAPS_KEY) return <LeafletFallback {...props} />
  return <GoogleNexaMap {...props} apiKey={GOOGLE_MAPS_KEY} />
}
