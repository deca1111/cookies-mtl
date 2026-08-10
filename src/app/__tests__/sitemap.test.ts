import { expect, test, vi } from 'vitest'

// connection() (rendu à la requête) n'a pas de portée requête sous vitest.
vi.mock('next/server', () => ({ connection: vi.fn(async () => {}) }))

vi.mock('@/lib/shops', () => ({
  listShops: vi.fn(async () => [
    { id: 1, slug: 'felix', name: 'Félix', address: 'a', lat: 0, lng: 0, googleMapsUrl: 'x', rating: 4, review: 'r' },
    { id: 2, slug: 'norton', name: 'Norton', address: 'b', lat: 0, lng: 0, googleMapsUrl: 'x', rating: 5, review: 'r' },
  ]),
}))

test('sitemap : accueil + une entrée par fiche, sur le domaine de prod', async () => {
  const sitemap = (await import('../sitemap')).default
  const entries = await sitemap()
  expect(entries[0].url).toBe('https://cookies.zucchinistudio.com')
  expect(entries.map((e) => e.url)).toContain('https://cookies.zucchinistudio.com/c/felix')
  expect(entries).toHaveLength(3)
})
