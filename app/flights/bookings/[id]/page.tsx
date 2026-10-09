import type { Metadata } from 'next'
import { FlightBookingStatusView } from '@/components/flights/flight-booking-status'

export const metadata: Metadata = {
  title: 'Flight booking | NexaGo',
  robots: { index: false },
}

export default async function FlightBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FlightBookingStatusView bookingId={id} />
}
