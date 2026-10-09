import type {
  CabinClass,
  DuffelOfferPayload,
  DuffelPassenger,
  FlightItinerarySummary,
  FlightOfferCard,
} from './types'

const DUFFEL_API = 'https://api.duffel.com'

export class DuffelError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message)
  }

  get isDefinitiveRejection() {
    return this.status !== null && this.status >= 400 && this.status < 500
  }
}

async function duffelRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const token = process.env.DUFFEL_ACCESS_TOKEN
  if (!token) throw new DuffelError('DUFFEL_ACCESS_TOKEN is not configured.', null)
  let response: Response
  try {
    response = await fetch(`${DUFFEL_API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Duffel-Version': 'v2',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new DuffelError('The flight provider could not be reached.', null)
  }
  const body = (await response.json().catch(() => null)) as { data?: T; errors?: Array<{ message?: string; title?: string }> } | null
  if (!response.ok || !body?.data) {
    const message = body?.errors?.[0]?.message ?? body?.errors?.[0]?.title ?? `Flight provider request failed (${response.status}).`
    throw new DuffelError(message, response.status)
  }
  return body.data
}

type RawPlace = { iata_code?: string; name?: string; city_name?: string }
type RawSegment = {
  operating_carrier?: { name?: string; iata_code?: string }
  marketing_carrier?: { name?: string; iata_code?: string }
  operating_carrier_flight_number?: string
  marketing_carrier_flight_number?: string
  departing_at?: string
  arriving_at?: string
  duration?: string | null
}
type RawSlice = { origin?: RawPlace; destination?: RawPlace; segments?: RawSegment[] }

export function summarizeItinerary(offer: DuffelOfferPayload): FlightItinerarySummary {
  const slices = (offer.slices ?? []) as RawSlice[]
  return {
    slices: slices.map((slice) => ({
      originCode: slice.origin?.iata_code ?? '',
      originName: slice.origin?.city_name ?? slice.origin?.name ?? '',
      destinationCode: slice.destination?.iata_code ?? '',
      destinationName: slice.destination?.city_name ?? slice.destination?.name ?? '',
      segments: (slice.segments ?? []).map((segment) => {
        const carrier = segment.operating_carrier ?? segment.marketing_carrier
        const number = segment.operating_carrier_flight_number ?? segment.marketing_carrier_flight_number ?? ''
        return {
          operatingCarrierName: carrier?.name ?? 'Airline',
          flightNumber: `${carrier?.iata_code ?? ''}${number}`,
          departingAt: segment.departing_at ?? '',
          arrivingAt: segment.arriving_at ?? '',
          duration: segment.duration ?? null,
        }
      }),
    })),
  }
}

export function toOfferCard(offer: DuffelOfferPayload): FlightOfferCard {
  return {
    id: offer.id,
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    expiresAt: offer.expires_at ?? null,
    airlineName: offer.owner?.name ?? 'Airline',
    requiresPassport: Boolean(offer.passenger_identity_documents_required),
    passengerCount: offer.passengers?.length ?? 1,
    ...summarizeItinerary(offer),
  }
}

export async function searchOffers(input: {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string
  adults: number
  cabinClass: CabinClass
}): Promise<FlightOfferCard[]> {
  const slices = [{ origin: input.origin, destination: input.destination, departure_date: input.departureDate }]
  if (input.returnDate) slices.push({ origin: input.destination, destination: input.origin, departure_date: input.returnDate })
  const data = await duffelRequest<{ offers?: DuffelOfferPayload[] }>(
    '/air/offer_requests?return_offers=true&supplier_timeout=20000',
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          slices,
          passengers: Array.from({ length: input.adults }, () => ({ type: 'adult' })),
          cabin_class: input.cabinClass,
        },
      }),
    },
    45_000,
  )
  return (data.offers ?? [])
    .sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
    .slice(0, 20)
    .map(toOfferCard)
}

export function getOffer(offerId: string) {
  return duffelRequest<DuffelOfferPayload>(`/air/offers/${encodeURIComponent(offerId)}`)
}

export function createOrder(input: {
  offerId: string
  passengers: DuffelPassenger[]
  amount: string
  currency: string
}) {
  return duffelRequest<{ id: string; booking_reference: string }>(
    '/air/orders',
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'instant',
          selected_offers: [input.offerId],
          passengers: input.passengers,
          payments: [{ type: 'balance', currency: input.currency, amount: input.amount }],
        },
      }),
    },
    60_000,
  )
}
