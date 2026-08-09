import { expect, test } from 'vitest'
import { homeJsonLd, shopJsonLd } from '../jsonld'

const shop = {
  id: 1, slug: 'felix', name: 'Félix', address: '1 rue Rachel E',
  lat: 45.52, lng: -73.58, googleMapsUrl: 'x', rating: 4.5, review: 'Croustillant.',
}

test('Bakery avec Review signé Cookies Club, SANS aggregateRating', () => {
  const ld = shopJsonLd(shop) as Record<string, unknown>
  expect(ld['@type']).toBe('Bakery')
  expect(ld.name).toBe('Félix')
  expect(JSON.stringify(ld)).not.toContain('aggregateRating')
  const review = ld.review as Record<string, unknown>
  expect((review.author as Record<string, unknown>).name).toBe('Cookies Club — Montréal')
  expect((review.reviewRating as Record<string, unknown>).ratingValue).toBe(4.5)
})

test('ItemList ordonné des fiches', () => {
  const ld = homeJsonLd([shop]) as Record<string, unknown>
  expect(ld['@type']).toBe('ItemList')
  const items = ld.itemListElement as Array<Record<string, unknown>>
  expect(items[0].url).toBe('https://cookies.zucchinistudio.com/c/felix')
})
