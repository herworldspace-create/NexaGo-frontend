export type MapCoordinate = { latitude: number; longitude: number }

export type NexaGoMapProps = {
  pickup?: MapCoordinate | null
  dropoff?: MapCoordinate | null
  stops?: MapCoordinate[]
  routePath?: MapCoordinate[]
  driverLocation?: MapCoordinate | null
  followDriver?: boolean
  onChooseDropoff?: (coordinate: MapCoordinate) => void
  /** Hide the built-in recenter/layers buttons when the shell renders its own. */
  showControls?: boolean
}
