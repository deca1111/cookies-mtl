import { expect, test, vi } from 'vitest'
import { reverseGeocode, searchPlaces } from '../photon'

function photonFeature(name: string, lat: number, lng: number, street?: string, city?: string) {
  return {
    geometry: { coordinates: [lng, lat] },
    properties: { name, street, housenumber: street ? '5252' : undefined, city },
  }
}

test('queries photon with Montréal bias and maps results', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [photonFeature('Félix & Norton', 45.5218, -73.5837, 'Boul. Saint-Laurent', 'Montréal')],
    }),
  })
  const results = await searchPlaces('félix', fetchMock as unknown as typeof fetch)

  const calledUrl = new URL(fetchMock.mock.calls[0][0] as string)
  expect(calledUrl.hostname).toBe('photon.komoot.io')
  expect(calledUrl.searchParams.get('q')).toBe('félix')
  expect(calledUrl.searchParams.get('lat')).toBe('45.5019')
  expect(calledUrl.searchParams.get('lon')).toBe('-73.5674')

  expect(results).toEqual([
    { name: 'Félix & Norton', address: '5252 Boul. Saint-Laurent, Montréal', lat: 45.5218, lng: -73.5837 },
  ])
})

test('drops results outside Montréal bounds and unnamed results', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [
        photonFeature('Paris Cookie', 48.85, 2.35),
        photonFeature('', 45.5, -73.6),
        photonFeature('Bon Cookie', 45.5, -73.6, undefined, 'Montréal'),
      ],
    }),
  })
  const results = await searchPlaces('cookie', fetchMock as unknown as typeof fetch)
  expect(results).toEqual([{ name: 'Bon Cookie', address: 'Montréal', lat: 45.5, lng: -73.6 }])
})

test('returns [] on network error or non-ok response', async () => {
  const failing = vi.fn().mockRejectedValue(new Error('net'))
  expect(await searchPlaces('x', failing as unknown as typeof fetch)).toEqual([])
  const notOk = vi.fn().mockResolvedValue({ ok: false })
  expect(await searchPlaces('x', notOk as unknown as typeof fetch)).toEqual([])
})

test('reverseGeocode compose l’adresse depuis la première feature', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [photonFeature('', 45.51, -73.57, 'rue Machin', 'Montréal')],
    }),
  })
  expect(await reverseGeocode(45.51, -73.57, fetchMock as unknown as typeof fetch)).toBe(
    '5252 rue Machin, Montréal'
  )
  const calledUrl = new URL(fetchMock.mock.calls[0][0] as string)
  expect(calledUrl.pathname).toBe('/reverse')
  expect(calledUrl.searchParams.get('lat')).toBe('45.51')
  expect(calledUrl.searchParams.get('lon')).toBe('-73.57')
})

test('reverseGeocode : null si vide ou en échec', async () => {
  const empty = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) })
  expect(await reverseGeocode(45.51, -73.57, empty as unknown as typeof fetch)).toBeNull()
  const boom = vi.fn().mockRejectedValue(new Error('net'))
  expect(await reverseGeocode(45.51, -73.57, boom as unknown as typeof fetch)).toBeNull()
  const noAddress = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features: [{ geometry: { coordinates: [-73.57, 45.51] }, properties: {} }] }),
  })
  expect(await reverseGeocode(45.51, -73.57, noAddress as unknown as typeof fetch)).toBeNull()
})
