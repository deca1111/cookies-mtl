import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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
  resolveLinkAction: vi.fn(),
}))

import { AdminApp } from '../AdminApp'
import type { Shop } from '@/lib/shops'

const mk = (id: number, name: string, rating: number): Shop => ({
  id, slug: `s${id}`, name, address: `${id} rue Test`, lat: 45.5, lng: -73.57,
  googleMapsUrl: 'https://maps.google.com/x', rating, review: '',
})
const shops = [mk(1, 'Miette', 4), mk(2, 'Éclair', 5), mk(3, 'Atelier', 3)]

afterEach(() => cleanup())

const rowNames = () => screen.getAllByRole('listitem').map((li) => li.querySelector('.font-display')?.textContent)

test('tri par défaut : note décroissante ; bouton Nom → alphabétique', () => {
  render(<AdminApp shops={shops} />)
  expect(rowNames()[0]).toContain('Éclair')
  fireEvent.click(screen.getByRole('button', { name: /^Nom/ }))
  expect(rowNames()[0]).toContain('Atelier')
})

test('re-cliquer le tri actif inverse le sens', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.click(screen.getByRole('button', { name: /^Note/ }))
  expect(rowNames()[0]).toContain('Atelier')
})
