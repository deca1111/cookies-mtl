import { afterEach, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ShopSheet } from '../ShopSheet'

// L'avis est saisi dans un <textarea> côté admin : ce qui y est tapé sur plusieurs
// lignes doit se lire pareil sur la carte. En HTML, `white-space: normal` écrase les
// sauts de ligne en simple espace — d'où la classe de préservation attendue ici.
const review = 'Première ligne.\nDeuxième ligne.\n\nAprès un blanc.'

const shop = {
  id: 1, slug: 'test', name: 'Test', address: '1 rue Test',
  lat: 45.5, lng: -73.5, googleMapsUrl: 'https://maps.google.com/x',
  rating: 4, review, inProgress: false, createdAt: '2026-01-01T00:00:00.000Z',
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

test('l’avis rend ses sauts de ligne comme dans l’admin', () => {
  localStorage.setItem('cmtl_lang', 'fr')
  const { container } = render(
    <LangProvider>
      <ShopSheet shop={shop} onClose={() => {}} />
    </LangProvider>
  )
  const verdict = container.querySelector('.cmtl-verdict')
  expect(verdict).not.toBeNull()
  expect(verdict!.textContent).toBe(review)
  expect(verdict!.className).toContain('whitespace-pre-line')
})
