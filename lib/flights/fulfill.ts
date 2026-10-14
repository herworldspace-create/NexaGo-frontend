import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { flightBookings } from '../db/schema'
import { getStripe } from '../stripe'
import { decryptJson } from './crypto'
import { createOrder, DuffelError } from './duffel'
import type { DuffelPassenger, FlightBookingStatus } from './types'

async function setStatus(id: string, status: FlightBookingStatus, extra: Partial<typeof flightBookings.$inferInsert> = {}) {
  await db.update(flightBookings).set({ ...extra, status, updatedAt: sql`now()` }).where(eq(flightBookings.id, id))
}

export async function markCheckoutFailed(sessionId: string) {
  await db
    .update(flightBookings)
    .set({ status: 'payment_failed', encryptedPassengers: null, updatedAt: sql`now()` })
    .where(and(eq(flightBookings.stripeSessionId, sessionId), eq(flightBookings.status, 'checkout_pending')))
}

async function refundBooking(id: string, paymentIntentId: string, reason: string) {
  try {
    await getStripe().refunds.create({ payment_intent: paymentIntentId, metadata: { bookingId: id } }, { idempotencyKey: `flight-refund-${id}` })
    await setStatus(id, 'refunded', { manualReviewReason: reason, encryptedPassengers: null })
  } catch {
    await setStatus(id, 'booking_failed_refund_pending', { manualReviewReason: `${reason} Automatic refund failed and needs attention.` })
  }
}

export async function fulfillCheckoutSession(sessionId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== 'paid') {
    if (session.status === 'expired') await markCheckoutFailed(sessionId)
    return
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  const [booking] = await db
    .update(flightBookings)
    .set({ status: 'booking_in_progress', stripePaymentIntentId: paymentIntentId, updatedAt: sql`now()` })
    .where(and(eq(flightBookings.stripeSessionId, sessionId), eq(flightBookings.status, 'checkout_pending')))
    .returning()

  if (!booking) return

  if (session.amount_total !== booking.amountMinor || session.currency?.toUpperCase() !== booking.currency.toUpperCase()) {
    await setStatus(booking.id, 'manual_review', { manualReviewReason: 'Paid amount did not match the booked fare.' })
    return
  }

  if (!booking.encryptedPassengers || !paymentIntentId) {
    await setStatus(booking.id, 'manual_review', { manualReviewReason: 'Booking details were incomplete after payment.' })
    return
  }

  let passengers: DuffelPassenger[]
  let amount: string
  try {
    const stored = decryptJson<{ passengers: DuffelPassenger[]; amount: string }>(booking.encryptedPassengers)
    passengers = stored.passengers
    amount = stored.amount
  } catch {
    await refundBooking(booking.id, paymentIntentId, 'Passenger details could not be read.')
    return
  }

  try {
    const order = await createOrder({ offerId: booking.duffelOfferId, passengers, amount, currency: booking.currency })
    await setStatus(booking.id, 'confirmed', {
      duffelOrderId: order.id,
      bookingReference: order.booking_reference,
      encryptedPassengers: null,
    })
  } catch (error) {
    if (error instanceof DuffelError && error.isDefinitiveRejection) {
      await refundBooking(booking.id, paymentIntentId, `The airline could not issue this ticket: ${error.message}`)
    } else {
      await setStatus(booking.id, 'manual_review', {
        manualReviewReason: 'The airline did not confirm in time. We are checking whether the ticket was issued before refunding.',
      })
    }
  }
}
