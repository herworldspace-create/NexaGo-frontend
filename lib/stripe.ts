import Stripe from 'stripe'

const globalForStripe = globalThis as typeof globalThis & { nexagoStripe?: Stripe }

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.')
  globalForStripe.nexagoStripe ??= new Stripe(secretKey)
  return globalForStripe.nexagoStripe
}
