import { bigint, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import type { FlightBookingStatus, FlightItinerarySummary } from '../flights/types'

export const flightBookings = pgTable('flight_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: uuid('idempotency_key').notNull().unique(),
  duffelOfferId: text('duffel_offer_id').notNull(),
  currency: varchar('currency').notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  encryptedPassengers: text('encrypted_passengers'),
  stripeSessionId: text('stripe_session_id').unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  duffelOrderId: text('duffel_order_id').unique(),
  bookingReference: text('booking_reference'),
  status: text('status').$type<FlightBookingStatus>().notNull().default('checkout_pending'),
  manualReviewReason: text('manual_review_reason'),
  itinerarySummary: jsonb('itinerary_summary').$type<FlightItinerarySummary>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FlightBookingRecord = typeof flightBookings.$inferSelect
