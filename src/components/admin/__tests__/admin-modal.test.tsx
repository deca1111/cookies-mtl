import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

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
import type { Shop } from '@/lib/shops'

const mk = (id: number, name: string, rating: number): Shop => ({
  id, slug: `s${id}`, name, address: `${id} rue Test`, lat: 45.5, lng: -73.57,
  googleMapsUrl: 'https://maps.google.com/x', rating, review: '', inProgress: false, createdAt: '2026-01-01T00:00:00.000Z',
})
const shops = [mk(1, 'Miette', 4), mk(2, 'Éclair', 5), mk(3, 'Atelier', 3)]

afterEach(() => cleanup())

// Ciblage par nom plutôt que par position : la ligne testée reste la même quel
// que soit le tri par défaut de la liste.
const editRowNamed = (name: string) => {
  const row = screen.getAllByRole('listitem').find((li) => li.textContent?.includes(name))
  if (!row) throw new Error(`ligne « ${name} » introuvable`)
  fireEvent.click(within(row).getByRole('button', { name: 'Modifier' }))
}

test('Modifier ouvre un dialog et marque la ligne éditée', () => {
  render(<AdminApp shops={shops} />)
  editRowNamed('Éclair')
  expect(screen.getByRole('dialog')).toBeDefined()
  const marked = document.querySelector('[data-editing="true"]')
  expect(marked?.textContent).toContain('Éclair')
})

test('Annuler ferme le dialog et retire le marqueur', () => {
  render(<AdminApp shops={shops} />)
  editRowNamed('Éclair')
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.querySelector('[data-editing="true"]')).toBeNull()
})
