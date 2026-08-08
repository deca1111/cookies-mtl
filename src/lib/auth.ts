import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'cmtl_admin'
export const SESSION_DAYS = 180

function hmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function signSession(expiresAtMs: number, secret: string): string {
  return `${expiresAtMs}.${hmac(String(expiresAtMs), secret)}`
}

export function verifySessionToken(token: string, secret: string, nowMs: number): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expiryStr, sig] = parts
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || expiry <= nowMs) return false
  const expected = hmac(expiryStr, secret)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(sigBuf, expectedBuf)
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return false
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  return !!token && verifySessionToken(token, secret, Date.now())
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}
