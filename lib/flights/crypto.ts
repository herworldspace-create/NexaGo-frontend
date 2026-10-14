import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function getKey(): Buffer {
  const secret = process.env.FLIGHT_DATA_ENCRYPTION_KEY?.trim()
  if (!secret) throw new Error('FLIGHT_DATA_ENCRYPTION_KEY is not configured.')
  if (secret.length < 16) throw new Error('FLIGHT_DATA_ENCRYPTION_KEY must be at least 16 characters.')
  const decoded = Buffer.from(secret, 'base64')
  if (decoded.length === 32) return decoded
  // Accept any strong secret by deriving a 32-byte AES-256 key from it.
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.')
}

export function decryptJson<T>(payload: string): T {
  const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64'))
  if (!iv || !tag || !ciphertext) throw new Error('Encrypted passenger payload is malformed.')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as T
}
