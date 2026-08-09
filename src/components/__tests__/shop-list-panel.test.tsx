import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ShopListPanel } from '../ShopListPanel'
import type { Shop } from '@/lib/shops'

const mk = (id: number, name: string, rating: number, lat: number, lng: number): Shop => ({
  id, slug: `s${id}`, name, address: `${id} rue Test`, lat, lng,
  googleMapsUrl: 'https://maps.google.com/x', rating, review: 'ok',
})
const shops = [mk(1, 'Miette', 4, 45.51, -73.57), mk(2, 'Éclair', 5, 45.53, -73.6), mk(3, 'Atelier', 3, 45.5, -73.55)]

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

function renderPanel(overrides: Partial<Parameters<typeof ShopListPanel>[0]> = {}) {
  localStorage.setItem('cmtl_lang', 'fr')
  return render(
    <LangProvider>
      <ShopListPanel shops={shops} open onClose={() => {}} onPick={() => {}} {...overrides} />
    </LangProvider>
  )
}

const rowNames = () => screen.getAllByRole('listitem').map((li) => li.querySelector('.font-display')?.textContent)

test('tri par défaut : note décroissante', () => {
  renderPanel()
  expect(rowNames()[0]).toContain('Éclair')
  expect(rowNames()[2]).toContain('Atelier')
})

test('re-taper le chip actif inverse le sens', () => {
  renderPanel()
  fireEvent.click(screen.getByRole('button', { name: 'Note' }))
  expect(rowNames()[0]).toContain('Atelier')
})

test('chip A–Z : tri alphabétique', () => {
  renderPanel()
  fireEvent.click(screen.getByRole('button', { name: 'A–Z' }))
  expect(rowNames()[0]).toContain('Atelier')
  expect(rowNames()[1]).toContain('Éclair')
})

test('taper une ligne appelle onPick avec le cookie', () => {
  const picked: Shop[] = []
  renderPanel({ onPick: (s) => picked.push(s) })
  fireEvent.click(screen.getByRole('button', { name: /Éclair/ }))
  expect(picked[0]?.name).toBe('Éclair')
})

test('géolocalisation acceptée : tri par distance + distances affichées', async () => {
  const getCurrentPosition = vi.fn((ok: PositionCallback) =>
    ok({ coords: { latitude: 45.5, longitude: -73.55 } } as GeolocationPosition)
  )
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
  renderPanel()
  fireEvent.click(screen.getByRole('button', { name: 'Distance' }))
  const items = await screen.findAllByRole('listitem')
  expect(items[0].textContent).toContain('Atelier')
  expect(items[0].textContent).toMatch(/m|km/)
})

test('géolocalisation refusée : message sobre, tri inchangé', async () => {
  const getCurrentPosition = vi.fn((_ok: PositionCallback, err?: PositionErrorCallback) =>
    err?.({ code: 1 } as GeolocationPositionError)
  )
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
  renderPanel()
  fireEvent.click(screen.getByRole('button', { name: 'Distance' }))
  expect(await screen.findByText(/Position indisponible/)).toBeDefined()
  expect(rowNames()[0]).toContain('Éclair')
})

test('Échap et chevron ferment le panneau', () => {
  let closed = 0
  renderPanel({ onClose: () => { closed += 1 } })
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Fermer la liste' }))
  expect(closed).toBe(2)
})

test('fermé : rien n’est rendu', () => {
  const { container } = renderPanel({ open: false })
  expect(container.querySelector('[role="list"]')).toBeNull()
})
