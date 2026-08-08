import { expect, test } from 'vitest'
import { validateShopInput } from '../validate'

const good = {
  name: 'Félix & Norton',
  address: '5252 Boul. Saint-Laurent, Montréal',
  lat: 45.5218,
  lng: -73.5837,
  googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  rating: 4.5,
  review: 'Gooey parfait.',
}

test('accepts a valid input and trims strings', () => {
  const res = validateShopInput({ ...good, name: '  Félix & Norton  ' })
  expect(res).toEqual({ ok: true, value: good })
})

test('rejects ratings off the 0–5 half-step grid', () => {
  for (const rating of [-0.5, 5.5, 4.7, Number.NaN]) {
    expect(validateShopInput({ ...good, rating }).ok).toBe(false)
  }
  for (const rating of [0, 0.5, 5]) {
    expect(validateShopInput({ ...good, rating }).ok).toBe(true)
  }
})

test('rejects coordinates outside Montréal', () => {
  expect(validateShopInput({ ...good, lat: 48.85, lng: 2.35 }).ok).toBe(false)
})

test('rejects empty name and overlong fields', () => {
  expect(validateShopInput({ ...good, name: '  ' }).ok).toBe(false)
  expect(validateShopInput({ ...good, review: 'x'.repeat(2001) }).ok).toBe(false)
})

test('rejects non-https googleMapsUrl', () => {
  expect(validateShopInput({ ...good, googleMapsUrl: 'javascript:alert(1)' }).ok).toBe(false)
})
