// Secrets et identité d'appareil (spec §5). Serveur uniquement (node:crypto, cookies).
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

// 9 octets → 12 caractères base64url : ~72 bits, introuvable par énumération.
export function generateSecret(): string {
  return randomBytes(9).toString('base64url')
}

export function generateClaimToken(): string {
  return randomBytes(24).toString('base64url')
}

// Un cookie par concours : un même téléphone peut participer à deux concours
// sans que l'identité de l'un écrase l'autre.
export function guestCookieName(contestId: number): string {
  return `cc_concours_${contestId}`
}

export async function readGuestToken(contestId: number): Promise<string | null> {
  return (await cookies()).get(guestCookieName(contestId))?.value ?? null
}

export async function writeGuestToken(contestId: number, token: string): Promise<void> {
  ;(await cookies()).set(guestCookieName(contestId), token, {
    httpOnly: true,
    // `false` en dev : un téléphone qui teste `next dev` via l'IP du réseau local,
    // en http simple, verrait sinon le cookie rejeté silencieusement.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function clearGuestToken(contestId: number): Promise<void> {
  ;(await cookies()).delete(guestCookieName(contestId))
}
