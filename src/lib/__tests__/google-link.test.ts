import { expect, test, vi } from 'vitest'
import { parseGoogleMapsUrl, resolveGoogleShareLink } from '../google-link'

const LONG_URL =
  'https://www.google.com/maps/place/F%C3%A9lix+%26+Norton/@45.5216,-73.586,17z/data=!3m1!4b1!4m6!3m5!1s0x4cc91bf8abc:0xdef!8m2!3d45.5218234!4d-73.5837119!16s'

test('parses name and precise !3d/!4d coords from long place URL', () => {
  expect(parseGoogleMapsUrl(LONG_URL)).toEqual({
    name: 'Félix & Norton',
    lat: 45.5218234,
    lng: -73.5837119,
  })
})

test('falls back to @lat,lng when !3d/!4d missing', () => {
  const url = 'https://www.google.com/maps/place/Cookie+Bar/@45.51,-73.57,17z/data=!4m2'
  expect(parseGoogleMapsUrl(url)).toEqual({ name: 'Cookie Bar', lat: 45.51, lng: -73.57 })
})

test('returns null on URLs without place segment or coords', () => {
  expect(parseGoogleMapsUrl('https://www.google.com/maps/@45.5,-73.6,12z')).toBeNull()
  expect(parseGoogleMapsUrl('https://example.com/nope')).toBeNull()
})

test('resolveGoogleShareLink follows redirect and keeps original share URL as listing link', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, url: LONG_URL })
  const out = await resolveGoogleShareLink('https://maps.app.goo.gl/AbC123', fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledWith('https://maps.app.goo.gl/AbC123', expect.objectContaining({ redirect: 'follow' }))
  expect(out).toEqual({
    name: 'Félix & Norton',
    lat: 45.5218234,
    lng: -73.5837119,
    googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  })
})

test('resolveGoogleShareLink rejects non-google hosts and network failures as null', async () => {
  expect(await resolveGoogleShareLink('https://evil.example/x')).toBeNull()
  const failing = vi.fn().mockRejectedValue(new Error('net'))
  expect(await resolveGoogleShareLink('https://maps.app.goo.gl/x', failing as unknown as typeof fetch)).toBeNull()
})
