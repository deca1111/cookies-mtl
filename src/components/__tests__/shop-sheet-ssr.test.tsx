// @vitest-environment node
import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShopSheet } from '../ShopSheet'

const shop = {
  id: 1, slug: 'test-cookie', name: 'Test Cookie', address: '123 Rue Test, Montréal',
  lat: 45.5219, lng: -73.5837, googleMapsUrl: 'https://example.com', rating: 4.5, review: 'Délicieux.', inProgress: false, createdAt: '2026-01-01T00:00:00.000Z',
}

test('ShopSheet renders on the server without window', () => {
  expect(() => renderToString(<ShopSheet shop={shop} onClose={() => {}} />)).not.toThrow()
})
