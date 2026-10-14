'use client'

import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'

type Coordinate = { latitude: number; longitude: number }
type NexaGoMapProps = {
  pickup?: Coordinate | null
  dropoff?: Coordinate | null
  stops?: Coordinate[]
  routePath?: Coordinate[]
  driverLocation?: Coordinate | null
  followDriver?: boolean
  onChooseDropoff?: (coordinate: Coordinate) => void
}

const defaultCenter: [number, number] = [12.9908, 7.6018]
const DRIVER_ANIMATION_MS = 1200

const driverIcon = L.divIcon({
  className: 'nexa-driver-icon',
  html: '<span class="nexa-driver-marker"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></span>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
})

function MapInteraction({ onChooseDropoff }: { onChooseDropoff?: NexaGoMapProps['onChooseDropoff'] }) {
  useMapEvents({
    click(event) {
      onChooseDropoff?.({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function MapCenter({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const map = useMap()
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), { duration: 0.5 })
  }, [latitude, longitude, map])
  return null
}

function FollowDriver({ latitude, longitude }: Coordinate) {
  const map = useMap()
  useEffect(() => {
    const target = L.latLng(latitude, longitude)
    if (!map.getBounds().pad(-0.2).contains(target)) map.panTo(target, { animate: true, duration: 0.8 })
  }, [latitude, longitude, map])
  return null
}

/** Eases the marker from its last rendered position to each new GPS fix instead of jumping. */
function AnimatedDriverMarker({ latitude, longitude }: Coordinate) {
  const markerRef = useRef<L.Marker | null>(null)
  const [initialPosition] = useState<[number, number]>(() => [latitude, longitude])

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const start = marker.getLatLng()
    const target = L.latLng(latitude, longitude)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      marker.setLatLng(target)
      return
    }
    let frame = 0
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DRIVER_ANIMATION_MS)
      const eased = 1 - (1 - progress) ** 3
      marker.setLatLng([start.lat + (target.lat - start.lat) * eased, start.lng + (target.lng - start.lng) * eased])
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [latitude, longitude])

  return (
    <Marker ref={markerRef} position={initialPosition} icon={driverIcon} keyboard={false}>
      <Tooltip direction="top" offset={[0, -18]}>Your driver</Tooltip>
    </Marker>
  )
}

export function NexaGoMap({ pickup, dropoff, stops = [], routePath = [], driverLocation, followDriver = false, onChooseDropoff }: NexaGoMapProps) {
  const route = routePath.map(({ latitude, longitude }) => [latitude, longitude] as [number, number])
  const centerCoordinate = pickup ?? dropoff ?? null
  const center: [number, number] = centerCoordinate
    ? [centerCoordinate.latitude, centerCoordinate.longitude]
    : defaultCenter

  return (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={false}
      scrollWheelZoom={false}
      className="nexa-map"
      aria-label="Interactive ride map. Select the map to set your destination."
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#ed7a18', weight: 4, opacity: 0.9 }} />}
      {pickup && <CircleMarker center={[pickup.latitude, pickup.longitude]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#188b91', fillOpacity: 1 }} />}
      {stops.map((stop, index) => (
        <CircleMarker key={`${stop.latitude}-${stop.longitude}-${index}`} center={[stop.latitude, stop.longitude]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0f172a', fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]}>{`Stop ${index + 1}`}</Tooltip>
        </CircleMarker>
      ))}
      {dropoff && <CircleMarker center={[dropoff.latitude, dropoff.longitude]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#ed7a18', fillOpacity: 1 }} />}
      {driverLocation && <AnimatedDriverMarker latitude={driverLocation.latitude} longitude={driverLocation.longitude} />}
      {driverLocation && followDriver && <FollowDriver latitude={driverLocation.latitude} longitude={driverLocation.longitude} />}
      {onChooseDropoff && <MapInteraction onChooseDropoff={onChooseDropoff} />}
      {!followDriver && <MapCenter latitude={centerCoordinate?.latitude} longitude={centerCoordinate?.longitude} />}
      <ZoomControl position="bottomright" />
    </MapContainer>
  )
}
