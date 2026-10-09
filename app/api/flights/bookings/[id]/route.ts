import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { flightBookings } from '@/lib/db/schema'
import { fulfillCheckoutSession } from '@/lib/flights/fulfill'
import type { FlightBookingStatusResponse } from '@/lib/flights/types'

export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'Booking not found.' }, { status: 404 })

  const load = async () => (await db.select().from(flightBookings).where(eq(flightBookings.id, id)).limit(1))[0]
  let booking = await load()
  if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })

  if (booking.status === 'checkout_pending' && booking.stripeSessionId) {
    try {
      await fulfillCheckoutSession(booking.stripeSessionId)
      booking = (await load()) ?? booking
    } catch {
      // Payment status is re-checked on the next poll.
    }
  }

  const response: FlightBookingStatusResponse = {
    status: booking.status,
    bookingReference: booking.bookingReference,
    itinerary: booking.itinerarySummary ?? null,
    manualReviewReason: booking.manualReviewReason,
  }
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
