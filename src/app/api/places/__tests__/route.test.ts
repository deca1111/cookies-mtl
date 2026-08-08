import { beforeEach, expect, test, vi } from 'vitest'

const isAdmin = vi.fn()
const searchPlaces = vi.fn()
vi.mock('@/lib/auth', () => ({ isAdmin: (...a: unknown[]) => isAdmin(...a) }))
vi.mock('@/lib/photon', () => ({ searchPlaces: (...a: unknown[]) => searchPlaces(...a) }))

import { GET } from '../route'

beforeEach(() => {
  isAdmin.mockReset().mockResolvedValue(true)
  searchPlaces.mockReset().mockResolvedValue([{ name: 'X', address: 'Y', lat: 45.5, lng: -73.6 }])
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
