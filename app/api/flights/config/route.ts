import { getFlightServiceStatus } from '@/lib/flights/config'

export const dynamic = 'force-dynamic'

export function GET() {
  const { searchEnabled, checkoutEnabled } = getFlightServiceStatus()
  return Response.json({ searchEnabled, checkoutEnabled })
}
