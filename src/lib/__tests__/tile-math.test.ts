import { expect, test } from 'vitest'
import { lonToTileX, latToTileY, viewportTileUrls } from '../tile-math'

// Valeurs de référence recalculées à la main (centre de Montréal, z13) :
// x = floor(((-73.5674+180)/360)·8192) = floor(2421.9) = 2421
// y = floor(((1 − asinh(tan(45.5019°))/π)/2)·8192) = floor(2930.7) = 2930
test('conversions Mercator au centre de Montréal', () => {
  expect(lonToTileX(-73.5674, 13)).toBe(2421)
  expect(latToTileY(45.5019, 13)).toBe(2930)
})

test('viewportTileUrls: 9 tuiles 3x3 autour du centre, chemin v1 + thème', () => {
  const urls = viewportTileUrls('https://blob.example', 'dark', -73.5674, 45.5019, 13)
  expect(urls).toHaveLength(9)
  expect(urls).toContain('https://blob.example/tiles/v1/dark/13/2421/2930.webp')
  expect(urls).toContain('https://blob.example/tiles/v1/dark/13/2420/2929.webp')
  expect(urls).toContain('https://blob.example/tiles/v1/dark/13/2422/2931.webp')
})

test('viewportTileUrls clampe le zoom hors pyramide', () => {
  const z18 = viewportTileUrls('b', 'light', -73.5674, 45.5019, 18)
  expect(z18.every((u) => u.includes('/16/'))).toBe(true)
  const z9 = viewportTileUrls('b', 'light', -73.5674, 45.5019, 9)
  expect(z9.every((u) => u.includes('/11/'))).toBe(true)
})
