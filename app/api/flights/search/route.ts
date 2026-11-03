import { getFlightServiceStatus, notConfiguredResponse } from '@/lib/flights/config'
import { DuffelError, searchOffers } from '@/lib/flights/duffel'
import type { CabinClass } from '@/lib/flights/types'
import { validateFlightSearch } from '@/lib/flights/validation'

export const maxDuration = 60

export async function POST(request: Request) {
  const status = getFlightServiceStatus()
  if (!status.searchEnabled) return notConfiguredResponse(status.missing)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const origin = String(body?.origin ?? '').trim().toUpperCase()
  const destination = String(body?.destination ?? '').trim().toUpperCase()
  const departureDate = String(body?.departureDate ?? '')
  const returnDate = body?.returnDate ? String(body.returnDate) : undefined
  const adults = Number(body?.adults ?? 1)
  const cabinClass = String(body?.cabinClass ?? 'economy')

  const validationError = validateFlightSearch({ origin, destination, departureDate, returnDate, adults, cabinClass })
  if (validationError) return Response.json({ error: validationError }, { status: 400 })

  try {
    const offers = await searchOffers({ origin, destination, departureDate, returnDate, adults, cabinClass: cabinClass as CabinClass })
    return Response.json({ offers })
  } catch (error) {
    const message = error instanceof DuffelError ? error.message : 'Flight search failed.'
    return Response.json({ error: message }, { status: 502 })
  }
}
