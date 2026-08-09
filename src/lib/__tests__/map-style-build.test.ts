import { expect, test } from 'vitest'
import { simplifyStyle, buildMapStyle } from '../map-style'

// Fixture : un id représentatif par famille gardée + un par famille supprimée.
type FixtureLayer = { id: string; type: string; paint?: Record<string, unknown> }
const fixture = (): { layers: FixtureLayer[] } => ({
  layers: [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill' },
    { id: 'water-intermittent', type: 'fill' },
    { id: 'waterway-river', type: 'line' },
    { id: 'waterway_tunnel', type: 'line' }, // underscore -> supprimé
    { id: 'park', type: 'fill' },
    { id: 'landcover-wood', type: 'fill' },
    { id: 'landcover-grass', type: 'fill' },
    { id: 'landcover-grass-park', type: 'fill' },
    { id: 'highway-minor', type: 'line' },
    { id: 'highway-secondary-tertiary-casing', type: 'line' },
    { id: 'bridge-trunk-primary', type: 'line' },
    { id: 'tunnel-motorway-link-casing', type: 'line' },
    { id: 'highway-name-minor', type: 'symbol' },
    { id: 'highway-name-major', type: 'symbol' },
    { id: 'label_city', type: 'symbol' },
    { id: 'label_other', type: 'symbol' },
    { id: 'water_name_point_label', type: 'symbol' },
    // familles supprimées :
    { id: 'building', type: 'fill' },
    { id: 'landuse-residential', type: 'fill' },
    { id: 'poi_transit', type: 'symbol' },
    { id: 'highway-shield-non-us', type: 'symbol' },
    { id: 'railway', type: 'line' },
    { id: 'boundary_2', type: 'line' },
    { id: 'highway-path', type: 'line' },
    { id: 'tunnel-service-track', type: 'line' },
    { id: 'aeroway-runway', type: 'line' },
    { id: 'ferry', type: 'line' },
    { id: 'road_oneway', type: 'symbol' },
    { id: 'label_state', type: 'symbol' },
    { id: 'label_country_1', type: 'symbol' },
  ],
})

test('simplifyStyle garde exactement les familles de la spec', () => {
  const kept = simplifyStyle(fixture()).layers.map((l) => l.id)
  expect(kept).toEqual([
    'background', 'water', 'water-intermittent', 'waterway-river', 'park',
    'landcover-wood', 'landcover-grass', 'landcover-grass-park', 'highway-minor',
    'highway-secondary-tertiary-casing', 'bridge-trunk-primary',
    'tunnel-motorway-link-casing', 'highway-name-minor', 'highway-name-major',
    'label_city', 'label_other', 'water_name_point_label',
  ])
})

test('buildMapStyle pose le halo thème sur toutes les couches symbol restantes', () => {
  const light = buildMapStyle(fixture(), 'light')
  const symbols = light.layers.filter((l) => l.type === 'symbol')
  expect(symbols.length).toBeGreaterThan(0)
  for (const s of symbols) {
    expect(s.paint?.['text-halo-color']).toBe('#f3ede3') // PALETTES.light.background
    expect(s.paint?.['text-halo-width']).toBe(1.5)
  }
  const dark = buildMapStyle(fixture(), 'dark')
  expect(dark.layers.find((l) => l.id === 'label_city')?.paint?.['text-halo-color']).toBe('#392c1d')
})

test('buildMapStyle applique aussi la palette (via applyPalette)', () => {
  const style = buildMapStyle(fixture(), 'light')
  expect(style.layers.find((l) => l.id === 'background')?.paint?.['background-color']).toBe('#f3ede3')
  expect(style.layers.find((l) => l.id === 'water')?.paint?.['fill-color']).toBe('#dbd3c2')
})
