import { beforeEach, expect, test, vi } from 'vitest'

const requireAdmin = vi.fn()
const insertShop = vi.fn()
const updateShop = vi.fn()
const deleteShop = vi.fn()
const updateTag = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }))
vi.mock('@/lib/shops', () => ({
  insertShop: (...a: unknown[]) => insertShop(...a),
  updateShop: (...a: unknown[]) => updateShop(...a),
  deleteShop: (...a: unknown[]) => deleteShop(...a),
}))
vi.mock('next/cache', () => ({ updateTag: (...a: unknown[]) => updateTag(...a) }))

import { createShopAction, deleteShopAction } from '../shops'

const good = {
  name: 'Félix & Norton', address: '5252 Boul. Saint-Laurent, Montréal',
  lat: 45.5218, lng: -73.5837, googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  rating: 4.5, review: 'Gooey parfait.',
}

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined)
  insertShop.mockReset().mockResolvedValue({ ...good, id: 1, slug: 'felix-norton' })
  deleteShop.mockReset()
  updateTag.mockReset()
})

test('creates shop, revalidates tag, returns slug', async () => {
  const res = await createShopAction(good)
  expect(res).toEqual({ ok: true, slug: 'felix-norton' })
  expect(updateTag).toHaveBeenCalledWith('shops')
})

test('builds Google listing URL when none provided', async () => {
  await createShopAction({ ...good, googleMapsUrl: '' })
  const passed = insertShop.mock.calls[0][0]
  expect(passed.googleMapsUrl).toContain('https://www.google.com/maps/search/?api=1&query=')
})

test('returns validation error without touching db', async () => {
  const res = await createShopAction({ ...good, rating: 4.7 })
  expect(res).toEqual({ ok: false, error: 'rating' })
  expect(insertShop).not.toHaveBeenCalled()
  expect(updateTag).not.toHaveBeenCalled()
})

test('rejects when not admin', async () => {
  requireAdmin.mockRejectedValue(new Error('Unauthorized'))
  await expect(createShopAction(good)).rejects.toThrow('Unauthorized')
  await expect(deleteShopAction(1)).rejects.toThrow('Unauthorized')
})
