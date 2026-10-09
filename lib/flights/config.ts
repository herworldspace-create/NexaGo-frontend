export interface FlightServiceStatus {
  searchEnabled: boolean
  checkoutEnabled: boolean
  missing: string[]
}

export function getFlightServiceStatus(): FlightServiceStatus {
  const missing: string[] = []
  if (!process.env.DUFFEL_ACCESS_TOKEN) missing.push('DUFFEL_ACCESS_TOKEN')
  const searchEnabled = missing.length === 0
  if (!process.env.FLIGHT_DATA_ENCRYPTION_KEY) missing.push('FLIGHT_DATA_ENCRYPTION_KEY')
  if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY')
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
  return { searchEnabled, checkoutEnabled: missing.length === 0, missing }
}

export function notConfiguredResponse(missing: string[]) {
  return Response.json(
    { code: 'not_configured', error: 'Flight booking is not configured yet.', missing },
    { status: 503 },
  )
}
