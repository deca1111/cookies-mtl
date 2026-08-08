import { expect, test } from 'vitest'
import { signSession, verifySessionToken } from '../auth'

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
