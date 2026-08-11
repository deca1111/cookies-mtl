import { beforeEach, expect, test, vi } from 'vitest'

const requireAdmin = vi.fn()
const insertShop = vi.fn()
const updateShop = vi.fn()
const deleteShop = vi.fn()
const setShopInProgress = vi.fn()
const updateTag = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }))
vi.mock('@/lib/shops', () => ({
  insertShop: (...a: unknown[]) => insertShop(...a),
  updateShop: (...a: unknown[]) => updateShop(...a),
  deleteShop: (...a: unknown[]) => deleteShop(...a),
  setShopInProgress: (...a: unknown[]) => setShopInProgress(...a),
}))
vi.mock('next/cache', () => ({ updateTag: (...a: unknown[]) => updateTag(...a) }))

import { createShopAction, deleteShopAction, setShopInProgressAction } from '../shops'

const good = {
  name: 'Félix & Norton', address: '5252 Boul. Saint-Laurent, Montréal',
  lat: 45.5218, lng: -73.5837, googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  rating: 4.5, review: 'Gooey parfait.', inProgress: false,
}

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined)
  insertShop.mockReset().mockResolvedValue({ ...good, id: 1, slug: 'felix-norton' })
  deleteShop.mockReset()
  setShopInProgress.mockReset()
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

test('createShopAction transmet inProgress à la db', async () => {
  await createShopAction({ ...good, inProgress: true })
  expect(insertShop.mock.calls[0][0].inProgress).toBe(true)
})

test('bascule « en cours » : écrit le booléen et invalide le cache', async () => {
  await setShopInProgressAction(7, true)
  expect(setShopInProgress).toHaveBeenCalledWith(7, true)
  // Sans invalidation, la carte publique garderait la fiche qu'on vient de retirer.
  expect(updateTag).toHaveBeenCalledWith('shops')
})

test('rejects when not admin', async () => {
  requireAdmin.mockRejectedValue(new Error('Unauthorized'))
  await expect(createShopAction(good)).rejects.toThrow('Unauthorized')
  await expect(deleteShopAction(1)).rejects.toThrow('Unauthorized')
  await expect(setShopInProgressAction(1, true)).rejects.toThrow('Unauthorized')
  expect(setShopInProgress).not.toHaveBeenCalled()
})
