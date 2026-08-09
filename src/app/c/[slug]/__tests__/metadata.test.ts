import { expect, test, vi } from 'vitest'

vi.mock('@/lib/shops', () => ({
  getShopBySlug: vi.fn(async (slug: string) =>
    slug === 'existe'
      ? { id: 1, slug: 'existe', name: 'Félix', address: '1 rue Rachel', lat: 45.5, lng: -73.6, googleMapsUrl: 'x', rating: 4.5, review: 'Top cookie.' }
      : null
  ),
  listShops: vi.fn(async () => []),
}))

test('generateMetadata : title, description bilingue, canonical', async () => {
  const { generateMetadata } = await import('../page')
  const md = await generateMetadata({ params: Promise.resolve({ slug: 'existe' }) } as never)
  expect(md.title).toBe('Félix — Cookies Club Montréal')
  expect(md.description).toContain('4,5')
  expect(md.description).toContain('cookie')
  expect(md.alternates?.canonical).toBe('/c/existe')
})

test('fiche inconnue : fallback au nom du site', async () => {
  const { generateMetadata } = await import('../page')
  const md = await generateMetadata({ params: Promise.resolve({ slug: 'absente' }) } as never)
  expect(md.title).toBe('Cookies Club — Montréal')
})
