import { getFlightServiceStatus, notConfiguredResponse } from '@/lib/flights/config'
import { DuffelError, searchOffers } from '@/lib/flights/duffel'
import type { CabinClass } from '@/lib/flights/types'

export const maxDuration = 60

const CABINS: CabinClass[] = ['economy', 'premium_economy', 'business', 'first']
const IATA = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function isFutureDate(value: string) {
  if (!DATE.test(value)) return false
  const date = new Date(`${value}T23:59:59Z`)
  return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now()
}

export async function POST(request: Request) {
  const status = getFlightServiceStatus()
  if (!status.searchEnabled) return notConfiguredResponse(status.missing)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const origin = String(body?.origin ?? '').trim().toUpperCase()
  const destination = String(body?.destination ?? '').trim().toUpperCase()
  const departureDate = String(body?.departureDate ?? '')
  const returnDate = body?.returnDate ? String(body.returnDate) : undefined
  const adults = Number(body?.adults ?? 1)
  const cabinClass = String(body?.cabinClass ?? 'economy') as CabinClass

  if (!IATA.test(origin) || !IATA.test(destination)) return Response.json({ error: 'Use 3-letter airport codes, like LOS or ABV.' }, { status: 400 })
  if (origin === destination) return Response.json({ error: 'Origin and destination must be different.' }, { status: 400 })
  if (!isFutureDate(departureDate)) return Response.json({ error: 'Choose a departure date from today onward.' }, { status: 400 })
  if (returnDate && (!isFutureDate(returnDate) || returnDate < departureDate)) return Response.json({ error: 'Return date must be on or after departure.' }, { status: 400 })
  if (!Number.isInteger(adults) || adults < 1 || adults > 4) return Response.json({ error: 'Choose between 1 and 4 adult passengers.' }, { status: 400 })
  if (!CABINS.includes(cabinClass)) return Response.json({ error: 'Choose a valid cabin.' }, { status: 400 })

  try {
    const offers = await searchOffers({ origin, destination, departureDate, returnDate, adults, cabinClass })
    return Response.json({ offers })
  } catch (error) {
    const message = error instanceof DuffelError ? error.message : 'Flight search failed.'
    return Response.json({ error: message }, { status: 502 })
  }
}
