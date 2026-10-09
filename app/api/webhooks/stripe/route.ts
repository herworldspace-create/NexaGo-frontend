import type Stripe from 'stripe'
import { fulfillCheckoutSession, markCheckoutFailed } from '@/lib/flights/fulfill'
import { getStripe } from '@/lib/stripe'

export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 })

  const signature = request.headers.get('stripe-signature')
  if (!signature) return Response.json({ error: 'Missing signature.' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret)
  } catch {
    return Response.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await fulfillCheckoutSession(event.data.object.id)
      break
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      await markCheckoutFailed(event.data.object.id)
      break
  }

  return Response.json({ received: true })
}
