import type { CabinClass } from "./types"
const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"]
const IATA = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
export function isIsoDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function normalizeAirportCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export function validateFlightSearch(
  input: { origin: string; destination: string; departureDate: string; returnDate?: string; adults: number; cabinClass: string },
  today = new Date().toISOString().slice(0, 10),
): string | null {
  if (!isIsoDate(today)) return 'Choose a valid current date.'
  const origin = normalizeAirportCode(input.origin)
  const destination = normalizeAirportCode(input.destination)
  if (!IATA.test(origin) || !IATA.test(destination)) return 'Use 3-letter airport codes, like LOS or ABV.'
  if (origin === destination) return 'Origin and destination must be different.'
  if (!isIsoDate(input.departureDate) || input.departureDate < today) return 'Choose a departure date from today onward.'
  if (input.returnDate && (!isIsoDate(input.returnDate) || input.returnDate < input.departureDate)) return 'Return date must be on or after departure.'
  if (!Number.isInteger(input.adults) || input.adults < 1 || input.adults > 4) return 'Choose between 1 and 4 adult passengers.'
  if (!CABINS.includes(input.cabinClass as CabinClass)) return 'Choose a valid cabin.'
  return null
}
