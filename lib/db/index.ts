import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForPool = globalThis as typeof globalThis & { nexagoFlightPool?: Pool }

export const pool = globalForPool.nexagoFlightPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
})

if (process.env.NODE_ENV !== 'production') globalForPool.nexagoFlightPool = pool

export const db = drizzle(pool, { schema })

export async function closeFlightDatabase() {
  await pool.end()
}

export { schema }

export type Database = typeof db

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export { and, eq } from 'drizzle-orm'

export { flightBookings } from './schema'

export type { FlightBookingRecord } from './schema'
