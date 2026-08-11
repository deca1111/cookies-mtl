import { beforeEach, expect, test, vi } from 'vitest'

const requireAdmin = vi.fn()
const insertShop = vi.fn()
const updateShop = vi.fn()
const deleteShop = vi.fn()
const setShopInProgress = vi.fn()
const listShopIdentities = vi.fn()
const updateTag = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }))
vi.mock('@/lib/shops', () => ({
  insertShop: (...a: unknown[]) => insertShop(...a),
  updateShop: (...a: unknown[]) => updateShop(...a),
  deleteShop: (...a: unknown[]) => deleteShop(...a),
  setShopInProgress: (...a: unknown[]) => setShopInProgress(...a),
  listShopIdentities: (...a: unknown[]) => listShopIdentities(...a),
}))
vi.mock('next/cache', () => ({ updateTag: (...a: unknown[]) => updateTag(...a) }))

import { createShopAction, deleteShopAction, setShopInProgressAction, updateShopAction } from '../shops'

const good = {
  name: 'Félix & Norton', address: '5252 Boul. Saint-Laurent, Montréal',
  lat: 45.5218, lng: -73.5837, googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  rating: 4.5, review: 'Gooey parfait.', inProgress: false,
}

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined)
  insertShop.mockReset().mockResolvedValue({ ...good, id: 1, slug: 'felix-norton' })
  updateShop.mockReset()
  deleteShop.mockReset()
  setShopInProgress.mockReset()
  listShopIdentities.mockReset().mockResolvedValue([])
  updateTag.mockReset()
})

// Le magasin déjà en base, à la position exacte de `good`.
const dejaEnBase = [{ id: 7, name: 'Félix & Norton', lat: good.lat, lng: good.lng }]

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

test('doublon refusé : rien n’est inséré, aucun cache invalidé', async () => {
  listShopIdentities.mockResolvedValue(dejaEnBase)
  expect(await createShopAction(good)).toEqual({ ok: false, error: 'duplicate' })
  expect(insertShop).not.toHaveBeenCalled()
  expect(updateTag).not.toHaveBeenCalled()
})

test('une succursale éloignée du même nom reste ajoutable', async () => {
  // ~1,1 km plus au nord : deux Tim Hortons de quartiers différents sont légitimes.
  listShopIdentities.mockResolvedValue([{ id: 7, name: 'Félix & Norton', lat: good.lat + 0.01, lng: good.lng }])
  expect((await createShopAction(good)).ok).toBe(true)
  expect(insertShop).toHaveBeenCalled()
})

test('le contrôle d’unicité lit la base à chaque création, jamais un cache', async () => {
  await createShopAction(good)
  expect(listShopIdentities).toHaveBeenCalledTimes(1)
})

test('renommage vers le nom d’une voisine : refusé aussi', async () => {
  listShopIdentities.mockResolvedValue(dejaEnBase)
  expect(await updateShopAction(1, good)).toEqual({ ok: false, error: 'duplicate' })
  expect(updateShop).not.toHaveBeenCalled()
})

test('une fiche qu’on ré-enregistre ne se détecte pas elle-même en doublon', async () => {
  listShopIdentities.mockResolvedValue(dejaEnBase)
  expect((await updateShopAction(7, good)).ok).toBe(true)
  expect(updateShop).toHaveBeenCalled()
})

test('rejects when not admin', async () => {
  requireAdmin.mockRejectedValue(new Error('Unauthorized'))
  await expect(createShopAction(good)).rejects.toThrow('Unauthorized')
  await expect(deleteShopAction(1)).rejects.toThrow('Unauthorized')
  await expect(setShopInProgressAction(1, true)).rejects.toThrow('Unauthorized')
  expect(setShopInProgress).not.toHaveBeenCalled()
})
