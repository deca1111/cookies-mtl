// Préférence de renderer carte (spec carte hybride). `'raster'` signifie : WebGL a
// échoué sur cet appareil, servir directement le fallback Leaflet aux visites
// suivantes. Fallback mémoire pour les contextes où localStorage jette (Safari mode
// privé) : la préférence tient alors le temps de la session JS.
const KEY = 'cmtl_renderer'
let sessionFallback: 'raster' | null = null

export function preferredRenderer(): 'webgl' | 'raster' {
  try {
    if (localStorage.getItem(KEY) === 'raster') return 'raster'
  } catch {
    // localStorage inaccessible — on retombe sur la mémoire de session
  }
  return sessionFallback ?? 'webgl'
}

export function markRasterPreferred(): void {
  sessionFallback = 'raster'
  try {
    localStorage.setItem(KEY, 'raster')
  } catch {
    // session-only, déjà couvert par sessionFallback
  }
}

export function clearRasterPreference(): void {
  sessionFallback = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // rien à faire
  }
}
