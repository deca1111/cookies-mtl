import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ShopSheet } from '../ShopSheet'

const shop = {
  id: 1, slug: 'test', name: 'Test', address: '1 rue Test',
  lat: 45.5, lng: -73.5, googleMapsUrl: 'https://maps.google.com/x',
  rating: 4, review: 'Bon.', inProgress: false, createdAt: '2026-01-01T00:00:00.000Z',
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderSheet() {
  localStorage.setItem('cmtl_lang', 'fr')
  return render(
    <LangProvider>
      <ShopSheet shop={shop} onClose={() => {}} />
    </LangProvider>
  )
}

test('la grille CTA a 2 boutons (Itinéraire, Partager), chacun avec icône', () => {
  const { container } = renderSheet()
  const grid = container.querySelector('.grid.grid-cols-2')
  expect(grid).not.toBeNull()
  expect(grid!.querySelectorAll('button')).toHaveLength(2)
  expect(grid!.querySelectorAll('svg')).toHaveLength(2)
})

test('l’icône copier vit à côté de l’adresse et déclenche le toast', async () => {
  let written = ''
  Object.assign(navigator, { clipboard: { writeText: async (s: string) => { written = s } } })
  renderSheet()
  fireEvent.click(screen.getByRole('button', { name: "Copier l’adresse" }))
  expect(await screen.findByRole('status')).toBeDefined()
  expect(screen.getByRole('status').textContent).toBe('Adresse copiée')
  expect(written).toBe('1 rue Test')
})
