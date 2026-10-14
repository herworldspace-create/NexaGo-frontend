export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first'

export interface FlightSegmentSummary {
  operatingCarrierName: string
  flightNumber: string
  departingAt: string
  arrivingAt: string
  duration: string | null
}

export interface FlightSliceSummary {
  originCode: string
  originName: string
  destinationCode: string
  destinationName: string
  segments: FlightSegmentSummary[]
}

export interface FlightItinerarySummary {
  slices: FlightSliceSummary[]
}

export interface FlightOfferCard extends FlightItinerarySummary {
  id: string
  totalAmount: string
  totalCurrency: string
  expiresAt: string | null
  airlineName: string
  requiresPassport: boolean
  passengerCount: number
}

export interface FlightPassengerDetails {
  title: string
  givenName: string
  familyName: string
  dateOfBirth: string
  gender: 'm' | 'f'
  email: string
  phoneNumber: string
  passportNumber?: string
  passportIssuingCountry?: string
  passportExpiry?: string
}

export interface DuffelPassenger {
  id: string
  type?: string
  title: string
  given_name: string
  family_name: string
  born_on: string
  gender: 'm' | 'f'
  email: string
  phone_number: string
  identity_documents?: Array<{
    type: 'passport'
    unique_identifier: string
    issuing_country_code: string
    expires_on: string
  }>
}

export interface DuffelOfferPayload {
  id: string
  total_amount: string
  total_currency: string
  expires_at?: string | null
  passenger_identity_documents_required?: boolean
  passengers?: Array<{ id?: string; type?: string }>
  owner?: { name?: string }
  slices?: Array<Record<string, unknown>>
}

export type FlightBookingStatus =
  | 'checkout_pending'
  | 'booking_in_progress'
  | 'confirmed'
  | 'payment_failed'
  | 'booking_failed_refund_pending'
  | 'refunded'
  | 'manual_review'

export interface FlightBookingStatusResponse {
  status: FlightBookingStatus
  bookingReference: string | null
  itinerary: FlightItinerarySummary | null
  manualReviewReason: string | null
}
