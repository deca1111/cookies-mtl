import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('maplibre-gl', () => {
  class MockMap {
    remove() {}
    addControl() {}
  }
  class MockMarker {
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
  setShopInProgressAction: vi.fn(async () => ({ ok: true })),
  resolveLinkAction: vi.fn(),
}))

import { AdminApp } from '../AdminApp'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

test('l’admin expose le toggle sombre/clair (retour QA v1.1)', () => {
  render(<AdminApp shops={[]} />)
  expect(screen.getByRole('button', { name: /mode sombre|mode clair/i })).toBeDefined()
})
