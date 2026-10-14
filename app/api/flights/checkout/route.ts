import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { flightBookings } from '@/lib/db/schema'
import { getFlightServiceStatus, notConfiguredResponse } from '@/lib/flights/config'
import { encryptJson } from '@/lib/flights/crypto'
import { DuffelError, getOffer, summarizeItinerary } from '@/lib/flights/duffel'
import { toMinorUnits } from '@/lib/flights/money'
import type { DuffelPassenger, FlightPassengerDetails } from '@/lib/flights/types'
import { getStripe } from '@/lib/stripe'

export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TITLES = ['mr', 'ms', 'mrs', 'miss', 'dr']
const NAME = /^[\p{L}][\p{L}' -]{0,49}$/u
const PHONE = /^\+[1-9]\d{7,14}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function validatePassenger(input: FlightPassengerDetails, requiresPassport: boolean): string | null {
  if (!TITLES.includes(input.title)) return 'Choose a title for each passenger.'
  if (!NAME.test(input.givenName?.trim() ?? '') || !NAME.test(input.familyName?.trim() ?? '')) return 'Enter names exactly as they appear on the travel document.'
  if (!DATE.test(input.dateOfBirth ?? '') || new Date(input.dateOfBirth) >= new Date()) return 'Enter a valid date of birth.'
  if (input.gender !== 'm' && input.gender !== 'f') return 'Choose the gender on the travel document.'
  if (!EMAIL.test(input.email ?? '') || input.email.length > 254) return 'Enter a valid email address.'
  if (!PHONE.test(input.phoneNumber ?? '')) return 'Enter phone numbers in international format, like +2348012345678.'
  if (requiresPassport) {
    if (!/^[A-Z0-9]{5,20}$/i.test(input.passportNumber ?? '')) return 'Enter a valid passport number.'
    if (!/^[A-Z]{2}$/.test(input.passportIssuingCountry ?? '')) return 'Enter the 2-letter passport country code, like NG.'
    if (!DATE.test(input.passportExpiry ?? '') || new Date(input.passportExpiry!) <= new Date()) return 'Passport must not be expired.'
  }
  return null
}

function getOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) return `${request.headers.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}`
  return request.headers.get('origin') ?? new URL(request.url).origin
}

export async function POST(request: Request) {
  const status = getFlightServiceStatus()
  if (!status.checkoutEnabled) return notConfiguredResponse(status.missing)

  const body = (await request.json().catch(() => null)) as {
    offerId?: string
    idempotencyKey?: string
    passengers?: FlightPassengerDetails[]
  } | null

  if (!body?.offerId || typeof body.offerId !== 'string' || body.offerId.length > 100) return Response.json({ error: 'Choose a flight first.' }, { status: 400 })
  if (!body.idempotencyKey || !UUID.test(body.idempotencyKey)) return Response.json({ error: 'Checkout request is invalid.' }, { status: 400 })
  if (!Array.isArray(body.passengers) || body.passengers.length < 1 || body.passengers.length > 4) return Response.json({ error: 'Passenger details are required.' }, { status: 400 })

  const stripe = getStripe()

  const [existing] = await db.select().from(flightBookings).where(eq(flightBookings.idempotencyKey, body.idempotencyKey)).limit(1)
  if (existing) {
    if (existing.duffelOfferId !== body.offerId) return Response.json({ error: 'Checkout request is invalid.' }, { status: 409 })
    if (existing.stripeSessionId && existing.status === 'checkout_pending') {
      const session = await stripe.checkout.sessions.retrieve(existing.stripeSessionId)
      if (session.status === 'open' && session.client_secret) return Response.json({ clientSecret: session.client_secret, bookingId: existing.id })
    }
    return Response.json({ error: 'This checkout has already been used. Start a new booking.' }, { status: 409 })
  }

  let offer
  try {
    offer = await getOffer(body.offerId)
  } catch (error) {
    return Response.json({ error: error instanceof DuffelError ? error.message : 'This fare is no longer available.' }, { status: 502 })
  }

  if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now() + 60_000) {
    return Response.json({ error: 'This fare has expired. Search again for current prices.' }, { status: 409 })
  }

  const offerPassengers = offer.passengers ?? []
  if (offerPassengers.length !== body.passengers.length || offerPassengers.some((passenger) => !passenger.id)) {
    return Response.json({ error: 'Passenger count does not match this fare.' }, { status: 400 })
  }

  const requiresPassport = Boolean(offer.passenger_identity_documents_required)
  for (const passenger of body.passengers) {
    const error = validatePassenger(passenger, requiresPassport)
    if (error) return Response.json({ error }, { status: 400 })
  }

  let amountMinor: number
  try {
    amountMinor = toMinorUnits(offer.total_amount, offer.total_currency)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unsupported fare.' }, { status: 400 })
  }

  const duffelPassengers: DuffelPassenger[] = body.passengers.map((passenger, index) => ({
    id: offerPassengers[index].id!,
    title: passenger.title,
    given_name: passenger.givenName.trim(),
    family_name: passenger.familyName.trim(),
    born_on: passenger.dateOfBirth,
    gender: passenger.gender,
    email: passenger.email.trim(),
    phone_number: passenger.phoneNumber,
    ...(requiresPassport
      ? {
          identity_documents: [{
            type: 'passport' as const,
            unique_identifier: passenger.passportNumber!.toUpperCase(),
            issuing_country_code: passenger.passportIssuingCountry!,
            expires_on: passenger.passportExpiry!,
          }],
        }
      : {}),
  }))

  const itinerary = summarizeItinerary(offer)

  const [booking] = await db
    .insert(flightBookings)
    .values({
      idempotencyKey: body.idempotencyKey,
      duffelOfferId: offer.id,
      currency: offer.total_currency.toUpperCase(),
      amountMinor,
      encryptedPassengers: encryptJson({ passengers: duffelPassengers, amount: offer.total_amount }),
      itinerarySummary: itinerary,
    })
    .onConflictDoNothing({ target: flightBookings.idempotencyKey })
    .returning()

  if (!booking) return Response.json({ error: 'Checkout is already being prepared. Try again.' }, { status: 409 })

  const route = itinerary.slices.map((slice) => `${slice.originCode} → ${slice.destinationCode}`).join(', ')
  const origin = getOrigin(request)

  try {
    const session = await stripe.checkout.sessions.create(
      {
        ui_mode: 'embedded_page',
        mode: 'payment',
        client_reference_id: booking.id,
        customer_email: body.passengers[0].email.trim(),
        metadata: { bookingId: booking.id },
        payment_intent_data: { metadata: { bookingId: booking.id } },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: offer.total_currency.toLowerCase(),
            unit_amount: amountMinor,
            product_data: { name: `Flight ${route}`, description: `${offer.owner?.name ?? 'Airline'} · ${duffelPassengers.length} passenger(s)` },
          },
        }],
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        return_url: `${origin}/flights/bookings/${booking.id}`,
      },
      { idempotencyKey: `flight-checkout-${body.idempotencyKey}` },
    )

    await db.update(flightBookings).set({ stripeSessionId: session.id, updatedAt: sql`now()` }).where(eq(flightBookings.id, booking.id))
    return Response.json({ clientSecret: session.client_secret, bookingId: booking.id })
  } catch {
    await db.update(flightBookings).set({ status: 'payment_failed', encryptedPassengers: null, updatedAt: sql`now()` }).where(eq(flightBookings.id, booking.id))
    return Response.json({ error: 'Payment could not be started. Please try again.' }, { status: 502 })
  }
}
