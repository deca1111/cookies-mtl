export type MapTheme = 'light' | 'dark'

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export function getMapStyleUrl(theme: MapTheme): string {
  const env = theme === 'dark' ? process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK : process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT
  return env || DEFAULT_STYLE
}

// Source de vérité du thème pour les cartes : l'attribut posé par src/lib/theme.ts
// (toggle manuel), sinon le système. Fallback 'light' hors navigateur (jsdom, SSR).
export function currentTheme(): MapTheme {
  if (typeof document !== 'undefined') {
    const t = document.documentElement.dataset.theme
    if (t === 'light' || t === 'dark') return t
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Spec palette (docs/superpowers/specs/2026-08-07-cookies-mtl-design.md — Direction visuelle)
// Light: crème ground with off-white streets — the streets read as the same lin
// as the sheet. Water is pulled warm so nothing on the map goes cold.
// Dark: chocolate ground, streets a step lighter, labels warm cream.
// Label colours are set for contrast against their own ground (both ≥ 4.5:1).
//
// building/buildingOutline/roadCasing/landuseAlt/waterway (Task 16b): the OpenFreeMap
// `bright` style has 119 layers; the five roles above extend the original four buckets
// (background/water/roads/parks) to reach every layer family still shipping stock OSM
// colours — building fills, bridge/tunnel casings, non-park landuse & landcover fills,
// and waterway/ferry lines. Each is interpolated between the already-approved ground and
// road tones of its theme, so new layers read as the same system rather than a new colour.
const PALETTES = {
  light: {
    background: '#f3ede3',
    water: '#dbd3c2',
    roads: '#fffdf8',
    parks: '#e5e5d2',
    text: '#5b4a38',
    building: '#e8dcc8',
    buildingOutline: '#cbb897',
    roadCasing: '#d9cbb0',
    landuseAlt: '#ece2d0',
    waterway: '#c7bda2',
  },
  dark: {
    background: '#241a13',
    water: '#181109',
    roads: '#3a2b1f',
    parks: '#25301f',
    text: '#bcaa98',
    building: '#2f2116',
    buildingOutline: '#4a3624',
    roadCasing: '#2b1f15',
    landuseAlt: '#2a1d13',
    waterway: '#20170f',
  },
}

type StyleLayer = { id: string; type: string; paint?: Record<string, unknown> }

// Recolors a MapLibre style JSON in place, by layer-id family. Covers every layer in the
// OpenFreeMap `bright` style (119/119) so both themes read as one coherent system instead
// of a recoloured background under stock OSM roads/buildings/landuse:
//   - background            -> background
//   - fill/fill-extrusion: building*        -> building (+ buildingOutline on fill-outline-color)
//                           *water*         -> water
//                           park/grass/wood -> parks
//                           landuse*/landcover* (remainder) -> landuseAlt
//                           aeroway/pier/highway (pavement areas) -> roadCasing
//   - line:                 bridge/tunnel   -> roadCasing (casing) or roads (deck)
//                           road/street/highway -> roads
//                           aeroway         -> roadCasing
//                           waterway/ferry  -> waterway
//                           railway/cablecar -> roadCasing
//                           boundary        -> text
//   - symbol                -> text
export function applyPalette<T extends { layers: StyleLayer[] }>(style: T, theme: MapTheme): T {
  const p = PALETTES[theme]
  for (const layer of style.layers) {
    layer.paint = layer.paint ?? {}
    const { id, type, paint } = layer

    if (type === 'background') {
      paint['background-color'] = p.background
    } else if (type === 'fill' || type === 'fill-extrusion') {
      const colorKey = type === 'fill' ? 'fill-color' : 'fill-extrusion-color'
      if (id.startsWith('building')) {
        paint[colorKey] = p.building
        if ('fill-outline-color' in paint) paint['fill-outline-color'] = p.buildingOutline
      } else if (id.includes('water')) {
        paint[colorKey] = p.water
      } else if (id === 'park' || id.includes('park') || id.includes('grass') || id.includes('wood')) {
        paint[colorKey] = p.parks
      } else if (id.startsWith('landuse') || id.startsWith('landcover')) {
        paint[colorKey] = p.landuseAlt
      } else if (id.includes('aeroway') || id.includes('pier') || id.includes('highway')) {
        paint[colorKey] = p.roadCasing
      }
    } else if (type === 'line') {
      if (id.includes('bridge') || id.includes('tunnel')) {
        paint['line-color'] = id.includes('casing') ? p.roadCasing : p.roads
      } else if (id.includes('road') || id.includes('street') || id.includes('highway')) {
        paint['line-color'] = p.roads
      } else if (id.includes('aeroway')) {
        paint['line-color'] = p.roadCasing
      } else if (id.includes('waterway') || id === 'ferry') {
        paint['line-color'] = p.waterway
      } else if (id.includes('railway') || id.includes('cablecar')) {
        paint['line-color'] = p.roadCasing
      } else if (id.includes('boundary')) {
        paint['line-color'] = p.text
      }
    } else if (type === 'symbol') {
      paint['text-color'] = p.text
    }
  }
  return style
}

// Style « épuré » (spec 2026-08-08-carte-hybride-raster) : rues + leurs noms,
// quartiers/villes, eau + ses noms, parcs — rien d'autre. Liste établie sur les
// 119 couches du style OpenFreeMap `bright` et validée visuellement sur démo.
const SIMPLIFY_KEEP_EXACT = new Set([
  'background', 'park', 'landcover-grass-park', 'landcover-wood', 'landcover-grass',
  'highway-name-minor', 'highway-name-major',
  'label_other', 'label_village', 'label_town', 'label_city', 'label_city_capital',
  'waterway_line_label', 'water_name_point_label', 'water_name_line_label',
])
const SIMPLIFY_KEEP_PATTERNS = [
  /^water($|-)/,
  /^waterway-/, // waterway_tunnel (underscore) reste exclu
  /^(highway|bridge|tunnel)-(motorway|trunk|primary|secondary|tertiary|minor|link)/,
]

export function simplifyStyle<T extends { layers: StyleLayer[] }>(style: T): T {
  style.layers = style.layers.filter(
    (l) => SIMPLIFY_KEEP_EXACT.has(l.id) || SIMPLIFY_KEEP_PATTERNS.some((re) => re.test(l.id))
  )
  return style
}

// Fabrique unique du style des deux cartes (MapLibre live ET pipeline de tuiles) :
// simplification -> palette -> halo. Le halo (1.5, couleur du fond) couvre le retour
// v1.1 « labels lisibles » et doit rester identique entre les deux rendus.
export function buildMapStyle<T extends { layers: StyleLayer[] }>(style: T, theme: MapTheme): T {
  const out = applyPalette(simplifyStyle(style), theme)
  const bg = PALETTES[theme].background
  for (const layer of out.layers) {
    if (layer.type === 'symbol') {
      layer.paint = layer.paint ?? {}
      layer.paint['text-halo-color'] = bg
      layer.paint['text-halo-width'] = 1.5
    }
  }
  return out
}
