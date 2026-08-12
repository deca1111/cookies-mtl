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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Ciblage par nom plutôt que par position : la ligne testée reste la même quel
// que soit le tri par défaut de la liste.
const editRowNamed = (name: string) => {
  const row = screen.getAllByRole('listitem').find((li) => li.textContent?.includes(name))
  if (!row) throw new Error(`ligne « ${name} » introuvable`)
  fireEvent.click(within(row).getByRole('button', { name: 'Modifier' }))
}

test('le modal d’édition n’a AUCUN champ adresse en saisie libre', () => {
  render(<AdminApp shops={shops} />)
  editRowNamed('Éclair')
  const dialog = screen.getByRole('dialog')
  const placeholders = Array.from(dialog.querySelectorAll('input')).map((i) => i.placeholder)
  expect(placeholders).not.toContain('Adresse')
  expect(dialog.textContent).toContain('rue Test') // adresse affichée en lecture seule
  expect(screen.getByRole('button', { name: 'Changer le lieu' })).toBeDefined()
})

test('« Changer le lieu » remplace adresse+position d’un coup via PlaceSearch', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({ results: [{ name: 'Nouveau', address: '9 rue Neuve, Montréal', lat: 45.52, lng: -73.58 }] })
      )
    )
  )
  render(<AdminApp shops={shops} />)
  editRowNamed('Éclair')
  fireEvent.click(screen.getByRole('button', { name: 'Changer le lieu' }))
  fireEvent.change(screen.getAllByPlaceholderText('Nom du magasin…')[1], { target: { value: 'Nouveau' } })
  fireEvent.click(await screen.findByText('9 rue Neuve, Montréal'))
  expect(screen.getByRole('dialog').textContent).toContain('9 rue Neuve, Montréal')
  // Le nom, lui, reste éditable à part : il n'a pas été écrasé par la re-recherche.
  expect(screen.getByDisplayValue('Éclair')).toBeDefined()
})
