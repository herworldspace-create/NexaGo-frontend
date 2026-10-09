import { ApiError } from './api'

const nairaFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })

export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount)
}

export function formatKobo(kobo: number): string {
  return nairaFormatter.format(kobo / 100)
}

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sign in to continue with your NexaGo account.'
    if (error.status === 0) return 'Network connection failed. Check your connection and try again.'
    if (error.status >= 500) return 'NexaGo is having trouble right now. Please try again in a moment.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

/** Accepts 080…, +234…, or 234… and returns the +234 form, or null when invalid. */
export function normalizeNigerianPhone(value: string): string | null {
  const digits = value.replace(/[\s-]/g, '')
  const match = digits.match(/^(?:\+?234|0)([789][01]\d{8})$/)
  return match ? `+234${match[1]}` : null
}

export function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function readNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = Number(source[key])
    if (source[key] !== null && source[key] !== undefined && Number.isFinite(value)) return value
  }
  return undefined
}
