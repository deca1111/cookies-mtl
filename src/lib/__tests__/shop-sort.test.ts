import { expect, test } from 'vitest'
import { distanceMeters, formatDistance, sortShops } from '../shop-sort'

const mkShop = (name: string, rating: number, lat: number, lng: number) => ({ name, rating, lat, lng })
const shops = [
  mkShop('Miette', 4, 45.51, -73.57),
  mkShop('Éclair', 5, 45.53, -73.6),
  mkShop('atelier', 3, 45.5, -73.55),
]

test('haversine : ~1,11 km par degré de latitude au 100e', () => {
  const d = distanceMeters({ lat: 45.5, lng: -73.57 }, { lat: 45.51, lng: -73.57 })
  expect(d).toBeGreaterThan(1050)
  expect(d).toBeLessThan(1180)
})

test('formatDistance : mètres arrondis à 10, km avec virgule, sans « ,0 »', () => {
  expect(formatDistance(348)).toBe('350 m')
  expect(formatDistance(1240)).toBe('1,2 km')
  expect(formatDistance(3004)).toBe('3 km')
})

test('tri par nom, insensible à la casse et aux accents', () => {
  const asc = sortShops(shops, 'name', 'asc').map((s) => s.name)
  expect(asc).toEqual(['atelier', 'Éclair', 'Miette'])
  expect(sortShops(shops, 'name', 'desc').map((s) => s.name)).toEqual(['Miette', 'Éclair', 'atelier'])
})

test('tri par note', () => {
  expect(sortShops(shops, 'rating', 'desc').map((s) => s.rating)).toEqual([5, 4, 3])
  expect(sortShops(shops, 'rating', 'asc').map((s) => s.rating)).toEqual([3, 4, 5])
})

test('tri par distance avec origine ; sans origine → nom asc', () => {
  const origin = { lat: 45.5, lng: -73.55 }
  expect(sortShops(shops, 'distance', 'asc', origin)[0].name).toBe('atelier')
  expect(sortShops(shops, 'distance', 'asc', null).map((s) => s.name)).toEqual(['atelier', 'Éclair', 'Miette'])
})

test('jamais de mutation du tableau source', () => {
  const before = shops.map((s) => s.name)
  sortShops(shops, 'rating', 'desc')
  expect(shops.map((s) => s.name)).toEqual(before)
})
