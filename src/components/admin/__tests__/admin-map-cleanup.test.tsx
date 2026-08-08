import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// This file has two tests that both render <AdminApp> with identical markup (same
// placeholders/button labels); without an explicit unmount between them, `screen`
// queries would see duplicate elements across both mounted trees. The spies are
// module-level too, so their call counts need resetting between tests as well.
afterEach(cleanup)
beforeEach(() => {
  mapConstructor.mockClear()
  removeSpy.mockClear()
})

// Task 17b bug 1 (admin mini-map leak): extends the mocked-maplibre pattern from
// admin-map-stability.test.tsx (kept unedited) with a `remove()` spy, so we can assert
// the mini-map's WebGL context is torn down the moment a draft closes — not deferred to
// the next openDraft, which is what let an orphaned MapLibre instance survive every
// add/cancel cycle before the fix.
const mapConstructor = vi.fn()
const removeSpy = vi.fn()

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapConstructor(options)
    }
    remove() {
      removeSpy()
    }
    addControl() {}
  }
  class MockMarker {
    constructor(options?: unknown) {}
    setLngLat() {
      return this
    }
    addTo() {
      return this
    }
    on() {
      return this
    }
    getLngLat() {
      return { lat: 45.5019, lng: -73.5674 }
    }
  }
  return { Map: MockMap, Marker: MockMarker }
})

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }))
vi.mock('@/app/actions/shops', () => ({
  createShopAction: vi.fn(async () => ({ ok: true, slug: 'test' })),
  updateShopAction: vi.fn(),
  deleteShopAction: vi.fn(),
  resolveLinkAction: vi.fn(),
}))

import { AdminApp } from '../AdminApp'

test('mini-map is destroyed immediately when a draft is cancelled, not deferred to the next draft', () => {
  render(<AdminApp shops={[]} />)

  const searchInput = screen.getByPlaceholderText('Nom du magasin…')
  fireEvent.change(searchInput, { target: { value: 'Biscuiterie' } })
  fireEvent.click(screen.getByText('Placer à la main'))

  expect(mapConstructor).toHaveBeenCalledTimes(1)
  expect(removeSpy).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Annuler'))

  // Before the fix, `remove()` only fired on the NEXT openDraft — closing without
  // reopening left the map (and its WebGL context) alive indefinitely.
  expect(removeSpy).toHaveBeenCalledTimes(1)
})

test('mini-map is destroyed immediately when a draft is saved successfully', async () => {
  render(<AdminApp shops={[]} />)

  const searchInput = screen.getByPlaceholderText('Nom du magasin…')
  fireEvent.change(searchInput, { target: { value: 'Biscuiterie' } })
  fireEvent.click(screen.getByText('Placer à la main'))

  expect(mapConstructor).toHaveBeenCalledTimes(1)
  expect(removeSpy).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Enregistrer'))

  // createShopAction resolves asynchronously; wait for the draft-closing state update.
  await screen.findByText('Ajouter un cookie')

  expect(removeSpy).toHaveBeenCalledTimes(1)
})
