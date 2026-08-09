import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ShopSheet } from '../ShopSheet'

const shop = {
  id: 1, slug: 'test', name: 'Test', address: '1 rue Test',
  lat: 45.5, lng: -73.5, googleMapsUrl: 'https://maps.google.com/x',
  rating: 4, review: 'Bon.',
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

test('les 3 CTA vivent dans une grille à colonnes égales, avec icône', () => {
  const { container } = renderSheet()
  const grid = container.querySelector('.grid.grid-cols-3')
  expect(grid).not.toBeNull()
  expect(grid!.querySelectorAll('button')).toHaveLength(3)
  expect(grid!.querySelectorAll('svg')).toHaveLength(3)
})

test('copier garde sa colonne : la structure ne bouge pas au clic', async () => {
  Object.assign(navigator, { clipboard: { writeText: async () => {} } })
  renderSheet()
  const btn = screen.getByRole('button', { name: "Copier l’adresse" })
  fireEvent.click(btn)
  expect(screen.getByRole('button', { name: "Copier l’adresse" })).toBe(btn) // aria stable
})
