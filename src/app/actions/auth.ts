'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, SESSION_DAYS, signSession } from '@/lib/auth'

export async function login(_prev: { error: string } | undefined, formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const expected = process.env.ADMIN_PASSWORD ?? ''
  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  const match = expected.length > 0 && a.length === b.length && timingSafeEqual(a, b)
  if (!match) return { error: 'wrong-password' }

  const expiresAtMs = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, signSession(expiresAtMs, process.env.ADMIN_SESSION_SECRET!), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(expiresAtMs),
    path: '/',
  })
  return undefined
}

export async function logout() {
  ;(await cookies()).delete(ADMIN_COOKIE)
}
