import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'cmtl_admin'
export const SESSION_DAYS = 180

// Contournement du mot de passe en développement local UNIQUEMENT : sur la
// machine de dev, n'importe quelle saisie (même vide) ouvre la session. Rien
// d'autre ne change — la session est signée et posée normalement, donc « Se
// déconnecter » se comporte comme en production.
//
// Deux verrous cumulés, tous deux HORS de portée de .env.local (une variable
// ajoutée par erreur au projet Vercel ne peut donc pas activer ceci en ligne) :
//   - NODE_ENV : seul `next dev` vaut 'development'. `next build`, `next start`
//     et toute exécution sur Vercel valent 'production' ; les tests valent 'test'.
//   - VERCEL : posé à '1' par la plateforme au build comme à l'exécution, y
//     compris en preview. Ceinture et bretelles si NODE_ENV était forcé.
//
// L'indice affiché sous le formulaire de connexion (voir LoginForm) découle du
// même prédicat : s'il apparaissait un jour sur le site déployé, c'est le signal
// que ce garde-fou a sauté.
// `Record<string, string | undefined>` plutôt que NodeJS.ProcessEnv : ce dernier
// déclare NODE_ENV comme obligatoire et limité à trois valeurs, alors qu'à
// l'exécution la variable peut être absente ou porter n'importe quoi — ce sont
// justement les cas que ce garde-fou doit refuser (et que les tests couvrent).
export function isDevPasswordBypass(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'development' && !env.VERCEL
}

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
