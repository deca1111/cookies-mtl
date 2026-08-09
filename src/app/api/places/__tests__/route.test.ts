import { beforeEach, expect, test, vi } from 'vitest'

const isAdmin = vi.fn()
const searchPlaces = vi.fn()
const reverseGeocode = vi.fn()
vi.mock('@/lib/auth', () => ({ isAdmin: (...a: unknown[]) => isAdmin(...a) }))
vi.mock('@/lib/photon', () => ({
  searchPlaces: (...a: unknown[]) => searchPlaces(...a),
  reverseGeocode: (...a: unknown[]) => reverseGeocode(...a),
}))

import { GET } from '../route'

beforeEach(() => {
  isAdmin.mockReset().mockResolvedValue(true)
  searchPlaces.mockReset().mockResolvedValue([{ name: 'X', address: 'Y', lat: 45.5, lng: -73.6 }])
  reverseGeocode.mockReset().mockResolvedValue('1234 rue Machin, Montréal')
})

test('returns results for admin', async () => {
  const res = await GET(new Request('http://x/api/places?q=felix'))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ results: [{ name: 'X', address: 'Y', lat: 45.5, lng: -73.6 }] })
  expect(searchPlaces).toHaveBeenCalledWith('felix')
})

test('401 when not admin', async () => {
  isAdmin.mockResolvedValue(false)
  const res = await GET(new Request('http://x/api/places?q=felix'))
  expect(res.status).toBe(401)
})

test('short query returns empty without hitting Photon', async () => {
  const res = await GET(new Request('http://x/api/places?q=f'))
  expect(await res.json()).toEqual({ results: [] })
  expect(searchPlaces).not.toHaveBeenCalled()
})

test('GET ?lat&lng renvoie l’adresse inversée (spec v1.2 §8)', async () => {
  const res = await GET(new Request('http://x/api/places?lat=45.51&lng=-73.57'))
  expect(await res.json()).toEqual({ address: '1234 rue Machin, Montréal' })
  expect(reverseGeocode).toHaveBeenCalledWith(45.51, -73.57)
  expect(searchPlaces).not.toHaveBeenCalled()
})

test('lat/lng invalides : retombe sur la recherche (résultats vides)', async () => {
  const res = await GET(new Request('http://x/api/places?lat=abc&lng=-73.57'))
  expect(await res.json()).toEqual({ results: [] })
  expect(reverseGeocode).not.toHaveBeenCalled()
})
