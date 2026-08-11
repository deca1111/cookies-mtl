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
  setShopInProgressAction: vi.fn(async () => ({ ok: true })),
  resolveLinkAction: vi.fn(),
}))

import { AdminApp } from '../AdminApp'
import type { Shop } from '@/lib/shops'

const NEVE = { lat: 45.5218, lng: -73.5837 }

const shops: Shop[] = [
  {
    id: 1, slug: 'cafe-neve', name: 'Café Névé', address: '151 rue Rachel E', ...NEVE,
    googleMapsUrl: 'https://maps.google.com/x', rating: 4, review: 'Bon.',
    inProgress: false, createdAt: '2026-01-01T00:00:00.000Z',
  },
]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Simule le parcours réel : taper dans la recherche, puis toucher une suggestion.
const pickFromSearch = async (name: string, coords: { lat: number; lng: number }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ results: [{ name, address: '1 rue Test, Montréal', ...coords }] }))
    )
  )
  render(<AdminApp shops={shops} />)
  fireEvent.change(screen.getByPlaceholderText('Nom du magasin…'), { target: { value: name } })
  fireEvent.click(await screen.findByText('1 rue Test, Montréal'))
}

test('choisir un magasin déjà en base ouvre SA fiche, pas une création vierge', async () => {
  await pickFromSearch('Café Névé', NEVE)
  const dialog = screen.getByRole('dialog')
  // Le modal d'édition, pas celui de création : l'avis existant est déjà là.
  expect(dialog.getAttribute('aria-label')).toBe('Modifier un cookie')
  expect(screen.getByDisplayValue('Bon.')).toBeDefined()
  expect(dialog.textContent).toContain('est déjà dans la base')
  // Et la ligne correspondante est marquée comme en cours d'édition.
  expect(document.querySelector('[data-editing="true"]')?.textContent).toContain('Café Névé')
})

test('le même nom loin de là reste une création normale (autre succursale)', async () => {
  // ~1,1 km plus au nord.
  await pickFromSearch('Café Névé', { lat: NEVE.lat + 0.01, lng: NEVE.lng })
  const dialog = screen.getByRole('dialog')
  expect(dialog.getAttribute('aria-label')).toBe('Ajouter un cookie')
  expect(dialog.textContent).not.toContain('est déjà dans la base')
})

test('un autre magasin à la même adresse reste une création normale', async () => {
  await pickFromSearch('Autre Café', NEVE)
  expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Ajouter un cookie')
})

test('l’avertissement disparaît quand on referme le modal', async () => {
  await pickFromSearch('Café Névé', NEVE)
  expect(screen.getByRole('dialog').textContent).toContain('est déjà dans la base')
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0])
  expect(screen.getByRole('dialog').textContent).not.toContain('est déjà dans la base')
})
