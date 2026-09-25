import { expect, test } from 'vitest'
import { generateClaimToken, generateSecret, guestCookieName } from '../contest-identity'

test('secret : 12 caractères url-safe, différent à chaque appel', () => {
  const a = generateSecret()
  expect(a).toMatch(/^[A-Za-z0-9_-]{12}$/)
  expect(generateSecret()).not.toBe(a)
})

test('jeton d’appareil : long et url-safe', () => {
  expect(generateClaimToken()).toMatch(/^[A-Za-z0-9_-]{32}$/)
})

test('un cookie par concours', () => {
  expect(guestCookieName(7)).toBe('cc_concours_7')
})
