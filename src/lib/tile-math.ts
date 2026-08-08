// Conversions slippy-tiles (Web Mercator). Utilisées pour précharger les tuiles du
// viewport pendant la fenêtre de grâce (spec carte hybride §4). Le pipeline
// scripts/render-tiles.mjs embarque sa propre copie de ces 4 lignes (script Node
// pur, hors compilation TS) — garder les deux en phase si la formule change.
export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}

export function latToTileY(lat: number, z: number): number {
  return Math.floor(
    ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z
  )
}

export const TILE_MIN_ZOOM = 11
export const TILE_MAX_ZOOM = 16

export function viewportTileUrls(
  base: string,
  theme: 'light' | 'dark',
  lng: number,
  lat: number,
  zoom: number
): string[] {
  const z = Math.max(TILE_MIN_ZOOM, Math.min(TILE_MAX_ZOOM, Math.round(zoom)))
  const cx = lonToTileX(lng, z)
  const cy = latToTileY(lat, z)
  const urls: string[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      urls.push(`${base}/tiles/v1/${theme}/${z}/${cx + dx}/${cy + dy}.webp`)
    }
  }
  return urls
}
