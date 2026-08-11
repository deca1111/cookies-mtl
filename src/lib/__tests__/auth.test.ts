import { expect, test } from 'vitest'
import { isDevPasswordBypass, signSession, verifySessionToken } from '../auth'

const SECRET = 'test-secret'

test('sign/verify round-trip', () => {
  const token = signSession(Date.now() + 1000 * 60, SECRET)
  expect(verifySessionToken(token, SECRET, Date.now())).toBe(true)
})

test('rejects expired token', () => {
  const token = signSession(1000, SECRET)
  expect(verifySessionToken(token, SECRET, 2000)).toBe(false)
})

test('rejects tampered expiry and wrong secret', () => {
  const token = signSession(Date.now() + 1000 * 60, SECRET)
  const [, sig] = token.split('.')
  expect(verifySessionToken(`${Date.now() + 9999999}.${sig}`, SECRET, Date.now())).toBe(false)
  expect(verifySessionToken(token, 'other-secret', Date.now())).toBe(false)
})

test('rejects malformed tokens without throwing', () => {
  for (const bad of ['', 'nodot', 'a.b.c', '123.']) {
    expect(verifySessionToken(bad, SECRET, Date.now())).toBe(false)
  }
})

test('rejects a same-string-length non-ascii signature without throwing', () => {
  const future = Date.now() + 60_000
  const sig = 'a'.repeat(63) + 'é'
  expect(verifySessionToken(`${future}.${sig}`, SECRET, Date.now())).toBe(false)
})

// Le contournement du mot de passe ne doit s'ouvrir QUE sur un poste de dev.
// Chaque cas fermé ci-dessous correspond à un scénario réel de déploiement.
test('contournement dev : ouvert par `next dev` sur la machine locale', () => {
  expect(isDevPasswordBypass({ NODE_ENV: 'development' })).toBe(true)
})

test('contournement dev : fermé partout sur Vercel, même si NODE_ENV dit development', () => {
  expect(isDevPasswordBypass({ NODE_ENV: 'development', VERCEL: '1' })).toBe(false)
  expect(isDevPasswordBypass({ NODE_ENV: 'production', VERCEL: '1' })).toBe(false)
})

test('contournement dev : fermé pour un build de production local (next build/start)', () => {
  expect(isDevPasswordBypass({ NODE_ENV: 'production' })).toBe(false)
})

test('contournement dev : fermé si NODE_ENV est absent ou inattendu', () => {
  expect(isDevPasswordBypass({})).toBe(false)
  expect(isDevPasswordBypass({ NODE_ENV: 'test' })).toBe(false)
  expect(isDevPasswordBypass({ NODE_ENV: 'Development' })).toBe(false)
})

test('contournement dev : fermé sous vitest, donc les tests exercent le vrai mot de passe', () => {
  expect(isDevPasswordBypass()).toBe(false)
})
