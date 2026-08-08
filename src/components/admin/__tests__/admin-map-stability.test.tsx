import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mapConstructor = vi.fn()
const markerConstructor = vi.fn()

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapConstructor(options)
    }
    remove() {}
    addControl() {}
  }
  class MockMarker {
    constructor(options?: unknown) {
      markerConstructor(options)
    }
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
  createShopAction: vi.fn(),
  updateShopAction: vi.fn(),
  deleteShopAction: vi.fn(),
  resolveLinkAction: vi.fn(),
}))

import { AdminApp } from '../AdminApp'

test('mini-map is built once per draft session, not on every name keystroke', () => {
  render(<AdminApp shops={[]} />)

  // Enter the manual path: type a name into the search box, then "Placer à la main".
  const searchInput = screen.getByPlaceholderText('Nom du magasin…')
  fireEvent.change(searchInput, { target: { value: 'Biscuiterie' } })
  fireEvent.click(screen.getByText('Placer à la main'))

  expect(mapConstructor).toHaveBeenCalledTimes(1)

  // Editing the draft's name field (in-form, not a new draft) must NOT rebuild the map.
  const nameInput = screen.getByPlaceholderText('Nom du magasin')
  fireEvent.change(nameInput, { target: { value: 'B' } })
  fireEvent.change(nameInput, { target: { value: 'Bi' } })
  fireEvent.change(nameInput, { target: { value: 'Bis' } })

  expect(mapConstructor).toHaveBeenCalledTimes(1)
})
