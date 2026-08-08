export type MapTheme = 'light' | 'dark'

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export function getMapStyleUrl(theme: MapTheme): string {
  const env = theme === 'dark' ? process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK : process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT
  return env || DEFAULT_STYLE
}

// Spec palette (docs/superpowers/specs/2026-08-07-cookies-mtl-design.md — Direction visuelle)
// Light: crème ground with off-white streets — the streets read as the same lin
// as the sheet. Water is pulled warm so nothing on the map goes cold.
// Dark: chocolate ground, streets a step lighter, labels warm cream.
// Label colours are set for contrast against their own ground (both ≥ 4.5:1).
const PALETTES = {
  light: { background: '#f3ede3', water: '#dbd3c2', roads: '#fffdf8', parks: '#e5e5d2', text: '#5b4a38' },
  dark: { background: '#241a13', water: '#181109', roads: '#3a2b1f', parks: '#25301f', text: '#bcaa98' },
}

type StyleLayer = { id: string; type: string; paint?: Record<string, unknown> }

// Recolors a MapLibre style JSON in place-categories: background, water, roads, landuse, labels.
export function applyPalette<T extends { layers: StyleLayer[] }>(style: T, theme: MapTheme): T {
  const p = PALETTES[theme]
  for (const layer of style.layers) {
    layer.paint = layer.paint ?? {}
    if (layer.type === 'background') layer.paint['background-color'] = p.background
    else if (layer.id.includes('water') && layer.type === 'fill') layer.paint['fill-color'] = p.water
    else if (layer.type === 'line' && (layer.id.includes('road') || layer.id.includes('street') || layer.id.includes('highway')))
      layer.paint['line-color'] = p.roads
    else if (layer.type === 'fill' && (layer.id.includes('park') || layer.id.includes('grass') || layer.id.includes('wood')))
      layer.paint['fill-color'] = p.parks
    else if (layer.type === 'symbol') layer.paint['text-color'] = p.text
  }
  return style
}
