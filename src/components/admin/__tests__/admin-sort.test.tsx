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

const setShopInProgressAction = vi.fn(async () => ({ ok: true }))

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }))
vi.mock('@/app/actions/shops', () => ({
  createShopAction: vi.fn(),
  updateShopAction: vi.fn(),
  deleteShopAction: vi.fn(),
  setShopInProgressAction: (...args: unknown[]) => setShopInProgressAction(...(args as [])),
  resolveLinkAction: vi.fn(),
}))

import { AdminApp } from '../AdminApp'
import type { Shop } from '@/lib/shops'

const mk = (
  id: number,
  name: string,
  rating: number,
  createdAt: string,
  inProgress = false
): Shop => ({
  id, slug: `s${id}`, name, address: `${id} rue Test`, lat: 45.5, lng: -73.57,
  googleMapsUrl: 'https://maps.google.com/x', rating, review: '', inProgress, createdAt,
})

// Ordre d'ajout volontairement décorrélé de la note et de l'alphabet, pour que
// chaque tri se distingue des deux autres.
const shops = [
  mk(1, 'Miette', 4, '2026-02-01T10:00:00.000Z'),
  mk(2, 'Éclair', 5, '2026-01-05T10:00:00.000Z'),
  mk(3, 'Atelier', 3, '2026-03-10T10:00:00.000Z', true),
]

afterEach(() => {
  cleanup()
  setShopInProgressAction.mockClear()
})

const rowNames = () => screen.getAllByRole('listitem').map((li) => li.querySelector('.font-display')?.textContent)

test('tri par défaut : ajout le plus récent en tête', () => {
  render(<AdminApp shops={shops} />)
  expect(rowNames()).toEqual(['Atelier', 'Miette', 'Éclair'])
})

test('bouton Nom → alphabétique ; bouton Note → note décroissante', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.click(screen.getByRole('button', { name: /^Nom/ }))
  expect(rowNames()[0]).toContain('Atelier')
  fireEvent.click(screen.getByRole('button', { name: /^Note/ }))
  expect(rowNames()[0]).toContain('Éclair')
})

test('re-cliquer le tri actif inverse le sens', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.click(screen.getByRole('button', { name: /^Récent/ }))
  expect(rowNames()[0]).toContain('Éclair')
})

test('recherche par nom : insensible à la casse et aux accents', () => {
  render(<AdminApp shops={shops} />)
  const search = screen.getByLabelText('Chercher un cookie par nom')
  fireEvent.change(search, { target: { value: 'eclair' } })
  expect(rowNames()).toEqual(['Éclair'])
})

test('recherche : sous-chaîne, pas seulement le début du nom', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.change(screen.getByLabelText('Chercher un cookie par nom'), { target: { value: 'ette' } })
  expect(rowNames()).toEqual(['Miette'])
})

test('recherche sans résultat : message, pas une liste vide muette', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.change(screen.getByLabelText('Chercher un cookie par nom'), { target: { value: 'zzz' } })
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.getByText('Aucun cookie ne correspond.')).toBeTruthy()
})

test('filtre « En cours » : ne garde que les fiches marquées', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.click(screen.getByRole('button', { name: /^En cours/ }))
  expect(rowNames()).toEqual(['Atelier'])
})

test('filtre et recherche se combinent', () => {
  render(<AdminApp shops={shops} />)
  fireEvent.click(screen.getByRole('button', { name: /^En cours/ }))
  fireEvent.change(screen.getByLabelText('Chercher un cookie par nom'), { target: { value: 'miette' } })
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('bascule de ligne : publie une fiche en cours, met en cours une fiche publiée', () => {
  render(<AdminApp shops={shops} />)
  // « Atelier » (en cours) est en tête du tri par défaut → sa bascule dit « Publier ».
  fireEvent.click(screen.getAllByRole('button', { name: 'Publier' })[0])
  expect(setShopInProgressAction).toHaveBeenCalledWith(3, false)

  fireEvent.click(screen.getAllByRole('button', { name: 'Passer en cours' })[0])
  expect(setShopInProgressAction).toHaveBeenLastCalledWith(1, true)
})
