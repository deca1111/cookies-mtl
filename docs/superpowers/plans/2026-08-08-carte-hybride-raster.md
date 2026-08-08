# Carte hybride (style épuré + fallback raster) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Style épuré partagé (MapLibre + tuiles), fallback Leaflet sans WebGL avec bascule instantanée mémorisée, pipeline de génération/upload des tuiles.

**Architecture:** `buildMapStyle()` (simplify → palette → halo) devient l'unique fabrique de style, consommée par CookieMap, AdminApp et le pipeline de tuiles. CookieMap orchestre deux renderers : MapLibre par défaut, `RasterMap` (Leaflet + tuiles pré-rendues sur Vercel Blob) dès que WebGL échoue — décision mémorisée dans `localStorage`. Spec : `docs/superpowers/specs/2026-08-08-carte-hybride-raster-design.md`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), maplibre-gl 6.2 (ESM-only), Leaflet 1.9, Vitest + Testing Library, sharp + playwright-core + esbuild + @vercel/blob (scripts), Vercel Blob (hébergement tuiles).

## Global Constraints

- maplibre-gl 6.2 est ESM-only : `import * as maplibregl`, PAS d'export default ; attributs WebGL via `canvasContextAttributes` uniquement (`preserveDrawingBuffer` top-level est ignoré en silence).
- Tests : `npm test` (vitest run). Lint : `npm run lint`. Les deux doivent passer à chaque commit.
- Toute copie UI passe par `dict` de `src/lib/i18n.ts`, en FR ET EN.
- Contrainte produit : tout gratuit, sans CB, sans compte tiers nouveau (Blob = déjà inclus dans le plan Vercel Hobby du projet).
- Chemins de tuiles : `tiles/v1/{theme}/{z}/{x}/{y}.webp` (préfixe `v1` bumpé à chaque régénération future pour invalider le CDN).
- Constantes de la spec : bbox Montréal `west -73.75, south 45.40, east -73.45, north 45.62` ; zooms 11–16 ; WebP quality 80 ; grâce restore **1500 ms** ; clé localStorage **`cmtl_renderer`** (valeur `'raster'` ou absente).
- Ne jamais casser les protections rounds 1–3 conservées : `pixelRatio` cap 2, `maxTileCacheSize: 40`, cache de style module-scope.
- Commits fréquents, branche `feature/carte-hybride-raster`, PR vers `main` à la fin (jamais de push direct sur main — ruleset actif).

## File Structure

- `src/lib/map-style.ts` — MODIFIÉ : + `simplifyStyle()`, + `buildMapStyle()` (halo inclus). `applyPalette` inchangé.
- `src/lib/map-renderer.ts` — NOUVEAU : préférence webgl/raster (localStorage + fallback session).
- `src/lib/tile-math.ts` — NOUVEAU : conversions Web-Mercator + URLs de tuiles du viewport (préchauffage).
- `src/components/RasterMap.tsx` — NOUVEAU : carte Leaflet (chargée dynamiquement).
- `src/components/CookieMap.tsx` — MODIFIÉ : orchestration renderer + détection/bascule.
- `src/components/admin/AdminApp.tsx` — MODIFIÉ : recoloration via `buildMapStyle`.
- `src/lib/i18n.ts` — MODIFIÉ : clé `retryDetailedMap`.
- `scripts/render-tiles.mjs` — NOUVEAU : pipeline rendu + découpe + upload Blob.
- `.gitignore` — MODIFIÉ : `.tiles-out/`, `.tiles-work/`.
- `README.md` — MODIFIÉ : section tuiles + env `NEXT_PUBLIC_TILES_BASE_URL`.

---

### Task 1: `simplifyStyle` + `buildMapStyle` dans map-style.ts

**Files:**
- Modify: `src/lib/map-style.ts` (après `applyPalette`, fin de fichier)
- Test: `src/lib/__tests__/map-style-build.test.ts` (nouveau)

**Interfaces:**
- Consumes: `applyPalette`, `PALETTES`, `StyleLayer`, `MapTheme` (déjà dans le fichier).
- Produces: `simplifyStyle<T extends {layers: StyleLayer[]}>(style: T): T` et `buildMapStyle<T extends {layers: StyleLayer[]}>(style: T, theme: MapTheme): T` — consommés par les Tasks 5, 6, 7 et par `scripts/render-tiles.mjs` (Task 8, via bundle esbuild).

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/map-style-build.test.ts` :

```ts
import { expect, test } from 'vitest'
import { simplifyStyle, buildMapStyle } from '../map-style'

// Fixture : un id représentatif par famille gardée + un par famille supprimée.
const fixture = () => ({
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
  expect(dark.layers.find((l) => l.id === 'label_city')?.paint?.['text-halo-color']).toBe('#241a13')
})

test('buildMapStyle applique aussi la palette (via applyPalette)', () => {
  const style = buildMapStyle(fixture(), 'light')
  expect(style.layers.find((l) => l.id === 'background')?.paint?.['background-color']).toBe('#f3ede3')
  expect(style.layers.find((l) => l.id === 'water')?.paint?.['fill-color']).toBe('#dbd3c2')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/map-style-build.test.ts`
Expected: FAIL — `simplifyStyle` n'est pas exporté.

- [ ] **Step 3: Write minimal implementation**

Ajouter en fin de `src/lib/map-style.ts` :

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/map-style-build.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-style.ts src/lib/__tests__/map-style-build.test.ts
git commit -m "feat: simplifyStyle + buildMapStyle — style épuré partagé avec halo"
```

---

### Task 2: Préférence de renderer (`map-renderer.ts`)

**Files:**
- Create: `src/lib/map-renderer.ts`
- Test: `src/lib/__tests__/map-renderer.test.ts`

**Interfaces:**
- Produces: `preferredRenderer(): 'webgl' | 'raster'`, `markRasterPreferred(): void`, `clearRasterPreference(): void` — consommés par CookieMap (Tasks 5–6).

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/map-renderer.test.ts` :

```ts
import { beforeEach, expect, test, vi } from 'vitest'
import { preferredRenderer, markRasterPreferred, clearRasterPreference } from '../map-renderer'

beforeEach(() => {
  clearRasterPreference()
  localStorage.clear()
  vi.restoreAllMocks()
})

test('webgl par défaut', () => {
  expect(preferredRenderer()).toBe('webgl')
})

test('markRasterPreferred persiste et se relit', () => {
  markRasterPreferred()
  expect(preferredRenderer()).toBe('raster')
  expect(localStorage.getItem('cmtl_renderer')).toBe('raster')
})

test('clearRasterPreference efface tout', () => {
  markRasterPreferred()
  clearRasterPreference()
  expect(preferredRenderer()).toBe('webgl')
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})

test('localStorage qui throw -> fallback session, sans exception (mode privé iOS)', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError')
  })
  expect(() => markRasterPreferred()).not.toThrow()
  // la préférence tient au moins pour la session courante
  expect(preferredRenderer()).toBe('raster')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/map-renderer.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Write minimal implementation**

`src/lib/map-renderer.ts` :

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/map-renderer.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-renderer.ts src/lib/__tests__/map-renderer.test.ts
git commit -m "feat: préférence de renderer carte persistée (cmtl_renderer)"
```

---

### Task 3: Maths de tuiles (`tile-math.ts`)

**Files:**
- Create: `src/lib/tile-math.ts`
- Test: `src/lib/__tests__/tile-math.test.ts`

**Interfaces:**
- Produces: `lonToTileX(lon: number, z: number): number`, `latToTileY(lat: number, z: number): number` (entiers, floor), `viewportTileUrls(base: string, theme: 'light' | 'dark', lng: number, lat: number, zoom: number): string[]` — consommé par CookieMap pour le préchauffage (Task 6). `viewportTileUrls` clampe le zoom à [11, 16] et renvoie les 9 tuiles (3×3) autour du centre, format `${base}/tiles/v1/${theme}/${z}/${x}/${y}.webp`.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/tile-math.test.ts` :

```ts
import { expect, test } from 'vitest'
import { lonToTileX, latToTileY, viewportTileUrls } from '../tile-math'

// Valeurs de référence calculées pendant la démo validée (centre de Montréal).
test('conversions Mercator au centre de Montréal', () => {
  expect(lonToTileX(-73.5674, 13)).toBe(2421)
  expect(latToTileY(45.5019, 13)).toBe(2929)
})

test('viewportTileUrls: 9 tuiles 3x3 autour du centre, chemin v1 + thème', () => {
  const urls = viewportTileUrls('https://blob.example', 'dark', -73.5674, 45.5019, 13)
  expect(urls).toHaveLength(9)
  expect(urls).toContain('https://blob.example/tiles/v1/dark/13/2421/2929.webp')
  expect(urls).toContain('https://blob.example/tiles/v1/dark/13/2420/2928.webp')
  expect(urls).toContain('https://blob.example/tiles/v1/dark/13/2422/2930.webp')
})

test('viewportTileUrls clampe le zoom hors pyramide', () => {
  const z18 = viewportTileUrls('b', 'light', -73.5674, 45.5019, 18)
  expect(z18.every((u) => u.includes('/16/'))).toBe(true)
  const z9 = viewportTileUrls('b', 'light', -73.5674, 45.5019, 9)
  expect(z9.every((u) => u.includes('/11/'))).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/tile-math.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Write minimal implementation**

`src/lib/tile-math.ts` :

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/tile-math.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tile-math.ts src/lib/__tests__/tile-math.test.ts
git commit -m "feat: maths de tuiles pour le préchauffage du fallback"
```

---

### Task 4: Composant `RasterMap` + clé i18n

**Files:**
- Create: `src/components/RasterMap.tsx`
- Modify: `src/lib/i18n.ts` (clé `retryDetailedMap` dans `fr` et `en`)
- Test: `src/components/__tests__/raster-map.test.tsx`

**Interfaces:**
- Consumes: `Shop` (`src/lib/shops`), `useLang` (`./LangProvider`), `currentTheme` (`@/lib/map-style`).
- Produces: `RasterMap({ shops, selected, onSelect, onRetryWebgl }: { shops: Shop[]; selected: Shop | null; onSelect: (s: Shop | null) => void; onRetryWebgl: () => void })` — monté par CookieMap (Task 5). La sélection/ShopSheet restent dans CookieMap ; RasterMap ne rend QUE la carte + le lien de sortie.
- Dépendances : `npm i leaflet && npm i -D @types/leaflet` (premier step).

- [ ] **Step 1: Installer Leaflet**

```bash
npm i leaflet && npm i -D @types/leaflet
```

- [ ] **Step 2: Write the failing test**

`src/components/__tests__/raster-map.test.tsx` :

```tsx
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach } from 'vitest'

// Mock Leaflet : capture les appels sans DOM réel. RasterMap importe Leaflet
// dynamiquement (import('leaflet')), le mock couvre le module entier.
const tileLayerSpy = vi.fn()
const markerSpy = vi.fn()
const setViewSpy = vi.fn()
const removeSpy = vi.fn()
let markerClickHandlers: Array<() => void> = []

vi.mock('leaflet', () => {
  const map = vi.fn(() => ({
    setView: setViewSpy.mockReturnThis(),
    remove: removeSpy,
    setMaxBounds: vi.fn(),
    flyTo: vi.fn(),
    on: vi.fn(),
  }))
  const tileLayer = vi.fn((url: string, opts: unknown) => {
    tileLayerSpy(url, opts)
    return { addTo: vi.fn() }
  })
  const marker = vi.fn((latlng: unknown, opts: unknown) => {
    markerSpy(latlng, opts)
    return {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'click') markerClickHandlers.push(cb)
      }),
    }
  })
  const divIcon = vi.fn((opts: unknown) => opts)
  const latLngBounds = vi.fn()
  return { default: { map, tileLayer, marker, divIcon, latLngBounds }, map, tileLayer, marker, divIcon, latLngBounds }
})
vi.mock('leaflet/dist/leaflet.css', () => ({}))

import { RasterMap } from '../RasterMap'
import type { Shop } from '@/lib/shops'

const shop = { slug: 'a', name: 'Chez Test', lat: 45.5, lng: -73.56 } as Shop

beforeEach(() => {
  vi.clearAllMocks()
  markerClickHandlers = []
})
afterEach(() => cleanup())

test('monte Leaflet avec les tuiles du thème et un pin cliquable par boutique', async () => {
  const onSelect = vi.fn()
  render(<RasterMap shops={[shop]} selected={null} onSelect={onSelect} onRetryWebgl={() => {}} />)

  await waitFor(() => expect(tileLayerSpy).toHaveBeenCalledTimes(1))
  const [url, opts] = tileLayerSpy.mock.calls[0] as [string, { maxNativeZoom: number }]
  expect(url).toContain('/tiles/v1/light/{z}/{x}/{y}.webp')
  expect(opts.maxNativeZoom).toBe(16)

  await waitFor(() => expect(markerSpy).toHaveBeenCalledTimes(1))
  expect(markerClickHandlers).toHaveLength(1)
  act(() => markerClickHandlers[0]())
  expect(onSelect).toHaveBeenCalledWith(shop)
})

test('le lien « réessayer » déclenche onRetryWebgl', async () => {
  const onRetry = vi.fn()
  const { findByText } = render(
    <RasterMap shops={[]} selected={null} onSelect={() => {}} onRetryWebgl={onRetry} />
  )
  fireEvent.click(await findByText('Réessayer la carte détaillée'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('nettoie la carte au démontage', async () => {
  const { unmount } = render(
    <RasterMap shops={[]} selected={null} onSelect={() => {}} onRetryWebgl={() => {}} />
  )
  await waitFor(() => expect(tileLayerSpy).toHaveBeenCalled())
  unmount()
  expect(removeSpy).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/raster-map.test.tsx`
Expected: FAIL — RasterMap inexistant.

- [ ] **Step 4: Ajouter la clé i18n**

Dans `src/lib/i18n.ts`, ajouter après `retry: 'Réessayer',` (bloc fr) :

```ts
    retryDetailedMap: 'Réessayer la carte détaillée',
```

et après `retry: 'Retry',` (bloc en) :

```ts
    retryDetailedMap: 'Retry the detailed map',
```

- [ ] **Step 5: Write minimal implementation**

`src/components/RasterMap.tsx` :

```tsx
'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { currentTheme } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { useLang } from './LangProvider'

const MTL_CENTER: [number, number] = [45.5019, -73.5674] // Leaflet est en [lat, lng]
const MTL_BOUNDS: [[number, number], [number, number]] = [
  [45.4, -73.75],
  [45.62, -73.45],
]
const TILES_BASE = process.env.NEXT_PUBLIC_TILES_BASE_URL ?? ''

// Fallback raster sans WebGL (spec carte hybride §3) : Leaflet + tuiles pré-rendues
// depuis notre propre style (scripts/render-tiles.mjs). Monté par CookieMap quand
// WebGL est indisponible ; la sélection et ShopSheet restent dans CookieMap.
// Leaflet est importé dynamiquement pour ne jamais peser sur les visiteurs sains
// (CookieMap ne monte ce composant qu'en mode raster, et le précharge pendant la
// fenêtre de grâce).
export function RasterMap({
  shops,
  selected,
  onSelect,
  onRetryWebgl,
}: {
  shops: Shop[]
  selected: Shop | null
  onSelect: (s: Shop | null) => void
  onRetryWebgl: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useLang()

  useEffect(() => {
    if (!containerRef.current) return
    const theme = currentTheme()
    let cancelled = false
    let map: import('leaflet').Map | null = null

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      map = L.map(containerRef.current, { zoomControl: true }).setView(
        selected ? [selected.lat, selected.lng] : MTL_CENTER,
        selected ? 15 : 12
      )
      map.setMaxBounds(MTL_BOUNDS)
      L.tileLayer(`${TILES_BASE}/tiles/v1/${theme}/{z}/{x}/{y}.webp`, {
        minZoom: 11,
        maxNativeZoom: 16, // au-delà : sur-zoom (agrandissement de la tuile z16)
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · style Cookies MTL',
      }).addTo(map)

      for (const shop of shops) {
        // Mêmes pins DOM que la carte MapLibre : la classe .cmtl-pin de globals.css
        // s'applique telle quelle (thème via la classe body, comme partout).
        const icon = L.divIcon({
          className: '',
          html: `<span class="cmtl-pin" role="button" aria-label="${shop.name}"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        })
        L.marker([shop.lat, shop.lng], { icon })
          .addTo(map)
          .on('click', () => {
            onSelect(shop)
            map?.flyTo([shop.lat, shop.lng], Math.max(map.getZoom(), 15))
          })
      }
      map.on('click', () => onSelect(null))

      // Équivalent minimal du GeolocateControl MapLibre (spec §3) : centre la carte
      // sur la position, sans suivi continu. Même coin haut-gauche que sur MapLibre.
      const GeoButton = L.Control.extend({
        options: { position: 'topleft' },
        onAdd() {
          const btn = document.createElement('button')
          btn.className = 'cmtl-geolocate leaflet-bar'
          btn.setAttribute('aria-label', 'Me localiser')
          btn.textContent = '◎'
          btn.onclick = () =>
            navigator.geolocation?.getCurrentPosition((pos) =>
              map?.setView([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), 14))
            )
          return btn
        },
      })
      map.addControl(new GeoButton())
    })()

    return () => {
      cancelled = true
      map?.remove()
      map = null
    }
    // même modèle que CookieMap : effet monté une fois, la sélection vit au-dessus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        onClick={onRetryWebgl}
        className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[12px] text-[color:var(--text-muted)] shadow-[var(--shadow-chip)] transition-colors hover:text-[color:var(--text-body)]"
      >
        {t('retryDetailedMap')}
      </button>
    </div>
  )
}
```

Note d'implémentation : si `flyTo`/`getZoom`/`addControl`/`Control.extend` manquent au mock du test, compléter le mock (`Control: { extend: vi.fn(() => vi.fn()) }`, `addControl: vi.fn()`) plutôt que retirer l'appel. Styler `.cmtl-geolocate` n'exige rien de plus que `leaflet-bar` (chrome Leaflet standard) — pas de CSS nouveau.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/raster-map.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 7: Vérifier la suite complète + lint, puis commit**

Run: `npm test && npm run lint`

```bash
git add src/components/RasterMap.tsx src/components/__tests__/raster-map.test.tsx src/lib/i18n.ts package.json package-lock.json
git commit -m "feat: RasterMap — fallback Leaflet sur tuiles pré-rendues"
```

---

### Task 5: CookieMap — bascule à l'init + préférence persistée

**Files:**
- Modify: `src/components/CookieMap.tsx`
- Test: `src/components/__tests__/cookie-map-raster-switch.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `preferredRenderer`/`markRasterPreferred`/`clearRasterPreference` (Task 2), `RasterMap` (Task 4), `buildMapStyle` (Task 1).
- Produces: comportement — `renderer` state `'webgl' | 'raster'` ; `switchToRaster()` (marque + bascule) ; `retryWebgl()` (efface la préférence + `setRenderer('webgl')` + bump `mapSession`). Task 6 réutilise `switchToRaster()` depuis le chemin de perte.

Modifications dans `CookieMap.tsx` :

1. Imports : remplacer `applyPalette` par `buildMapStyle` ; ajouter `preferredRenderer, markRasterPreferred, clearRasterPreference` et `RasterMap`.
2. `getRecoloredStyle` : `const style = buildMapStyle(await res.json(), theme)`.
3. État : `const [renderer, setRenderer] = useState<'webgl' | 'raster'>(() => preferredRenderer())`.
4. `switchToRaster` / `retryWebgl` :

```tsx
  const switchToRaster = () => {
    markRasterPreferred()
    setMapError(false)
    setRenderer('raster')
  }
  const retryWebgl = () => {
    clearRasterPreference()
    setRenderer('webgl')
    setMapSession((s) => s + 1) // budget frais pour le nouvel essai WebGL
  }
```

5. L'effet principal commence par `if (renderer !== 'webgl') return` et ajoute `renderer` à ses deps (`[mapSession, renderer]`).
6. Dans `init()`, séparer les deux familles d'échec — le fetch de style garde le chemin de retries existant (souci réseau ≠ WebGL malade), la construction de la Map bascule immédiatement :

```tsx
      let style
      try {
        style = await getRecoloredStyle(theme, getMapStyleUrl(theme))
      } catch {
        // échec réseau/style : chemin de retries bornés existant, inchangé
        if (!cancelled) {
          setMapError(true)
          failureCount += 1
          if (failureCount < 3 && rebuildCount < MAX_REBUILDS_PER_MOUNT) {
            rebuildCount += 1
            if (failureRetryTimeout) clearTimeout(failureRetryTimeout)
            failureRetryTimeout = setTimeout(() => {
              failureRetryTimeout = null
              if (!cancelled) init()
            }, 3000)
          }
        }
        return
      }
      if (cancelled || !containerRef.current) return
      try {
        const map = new maplibregl.Map({ /* options inchangées */ })
        /* ...suite inchangée (mapRef, contrôles, markers, handlers)... */
      } catch {
        // création du contexte WebGL refusée : bascule immédiate, aucun écran d'erreur
        if (!cancelled) switchToRaster()
        return
      }
```

   (Le `finally { rebuilding = false }` existant enveloppe le tout comme aujourd'hui.)
7. Rendu : quand `renderer === 'raster'`, remplacer le `<div ref={containerRef}>` par :

```tsx
        <RasterMap shops={shops} selected={selected} onSelect={setSelected} onRetryWebgl={retryWebgl} />
```

   Le toggle FR/EN et `{selected && <ShopSheet .../>}` restent rendus dans les deux modes.

- [ ] **Step 1: Write the failing test**

`src/components/__tests__/cookie-map-raster-switch.test.tsx` :

```tsx
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

const mapConstructor = vi.fn()
vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapConstructor(options)
    }
    addControl() {}
    on() {}
    easeTo() {}
    remove() {}
    getCanvas() {
      return { getContext: () => ({ isContextLost: () => false }) } as unknown as HTMLCanvasElement
    }
  }
  class MockMarker {
    setLngLat() { return this }
    addTo() { return this }
  }
  class MockGeolocateControl {}
  return { Map: MockMap, Marker: MockMarker, GeolocateControl: MockGeolocateControl }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// RasterMap est testé pour lui-même (raster-map.test.tsx) ; ici un stub suffit et
// évite de mocker Leaflet en plus de MapLibre.
vi.mock('../RasterMap', () => ({
  RasterMap: (props: { onRetryWebgl: () => void }) => (
    <div data-testid="raster-map">
      <button onClick={props.onRetryWebgl}>retry-webgl</button>
    </div>
  ),
}))

import { CookieMap, __clearStyleCacheForTests } from '../CookieMap'

beforeEach(() => {
  mapConstructor.mockReset()
  localStorage.clear()
  __clearStyleCacheForTests()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ layers: [] }) })) as unknown as typeof fetch
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('échec de création du contexte WebGL à l’init -> RasterMap immédiat + préférence écrite', async () => {
  mapConstructor.mockImplementation(() => {
    throw new Error('GPUInitializationError')
  })
  const { findByTestId, container } = render(<CookieMap shops={[]} />)

  await findByTestId('raster-map')
  // aucun écran d'erreur : la bascule remplace le message
  expect(container.querySelector('.absolute.inset-0')).toBeNull()
  expect(localStorage.getItem('cmtl_renderer')).toBe('raster')
})

test('préférence raster présente au mount -> MapLibre jamais instancié, pas de fetch de style', async () => {
  localStorage.setItem('cmtl_renderer', 'raster')
  const { findByTestId } = render(<CookieMap shops={[]} />)
  await findByTestId('raster-map')
  expect(mapConstructor).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
})

test('échec du fetch de style -> retries existants, PAS de bascule raster (souci réseau)', async () => {
  global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
  const { container, queryByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(container.querySelector('.absolute.inset-0')).not.toBeNull())
  expect(queryByTestId('raster-map')).toBeNull()
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})

test('« réessayer » depuis le raster efface la préférence et retente MapLibre', async () => {
  localStorage.setItem('cmtl_renderer', 'raster')
  const { findByTestId, findByText } = render(<CookieMap shops={[]} />)
  await findByTestId('raster-map')

  ;(await findByText('retry-webgl')).click()

  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/cookie-map-raster-switch.test.tsx`
Expected: FAIL — CookieMap n'a ni RasterMap ni bascule.

- [ ] **Step 3: Implémenter les modifications 1–7 ci-dessus**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/cookie-map-raster-switch.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Vérifier que les tests context-loss existants passent encore**

Run: `npm test`
Expected: PASS — cette task ne touche pas encore au chemin de perte (grâce 6000 ms intacte, réécrite en Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/components/CookieMap.tsx src/components/__tests__/cookie-map-raster-switch.test.tsx
git commit -m "feat: bascule raster à l'init WebGL + préférence persistée"
```

---

### Task 6: CookieMap — chemin de perte (grâce 1,5 s, préchauffage, 2ᵉ perte)

**Files:**
- Modify: `src/components/CookieMap.tsx` (constantes + `handleContextLoss`/`scheduleRebuild` + `onVisibilityChange`)
- Modify: `src/components/__tests__/cookie-map-context-loss.test.tsx` (réécriture partielle)

**Interfaces:**
- Consumes: `switchToRaster()` (Task 5), `viewportTileUrls` (Task 3), `RasterMap` (préchargé via `import('./RasterMap')`).
- Produces: comportement final de la spec §4. `RESTORE_GRACE_MS` passe de 6000 à **1500**. `scheduleRebuild` est SUPPRIMÉ (la bascule le remplace) ; `REBUILD_COOLDOWN_MS` disparaît avec lui ; `MAX_REBUILDS_PER_MOUNT`/`failureCount` ne servent plus qu'aux retries de fetch de style (chemin conservé en Task 5).

Modifications dans `CookieMap.tsx` :

1. Constantes : `RESTORE_GRACE_MS = 1500` (commentaire : le restore natif utile tire en ~1 s ; l'issue est une bascule bon marché, plus un rebuild). Supprimer `REBUILD_COOLDOWN_MS` et le commentaire de `MAX_REBUILDS_PER_MOUNT` est réduit au seul rôle restant (retries de fetch).
2. Variables d'effet : remplacer `rebuilding`/`rebuildTimeout` par `lossCount = 0` et `pendingHiddenLoss = false`. Garder `graceTimeout`, `failureRetryTimeout`, `failureCount`, `rebuildCount`.
3. Préchauffage + nouveau `handleContextLoss` :

```tsx
    // Spec carte hybride §4 : pendant la grâce on préchauffe le fallback (chunk
    // Leaflet + 9 tuiles du viewport) pour que la bascule, si elle a lieu, soit
    // quasi instantanée. Si le restore natif gagne, on n'a dépensé que quelques Ko.
    function warmRasterFallback(map: maplibregl.Map) {
      import('./RasterMap').catch(() => {})
      const base = process.env.NEXT_PUBLIC_TILES_BASE_URL ?? ''
      const c = map.getCenter()
      for (const url of viewportTileUrls(base, theme, c.lng, c.lat, map.getZoom())) {
        fetch(url).catch(() => {})
      }
    }

    function handleContextLoss(map: maplibregl.Map) {
      if (cancelled || graceTimeout) return
      lossCount += 1
      // 2e perte de la même session : le restore natif a déjà eu sa chance —
      // bascule immédiate, sans nouvelle grâce (Leaflet est déjà chaud).
      if (lossCount >= 2) {
        map.remove()
        if (mapRef.current === map) mapRef.current = null
        switchToRaster()
        return
      }
      warmRasterFallback(map)
      // Perte onglet caché (cas bénin typique : iOS reprend le GPU en arrière-plan,
      // restore gratuit au retour) : ni bascule ni décompte en arrière-plan — la
      // grâce court à partir du retour visible, via onVisibilityChange.
      if (document.visibilityState !== 'visible') {
        pendingHiddenLoss = true
        return
      }
      startGrace(map)
    }

    function startGrace(map: maplibregl.Map) {
      graceTimeout = setTimeout(() => {
        graceTimeout = null
        if (cancelled) return
        map.remove()
        if (mapRef.current === map) mapRef.current = null
        switchToRaster()
      }, RESTORE_GRACE_MS)
    }
```

4. Handler `webglcontextrestored` (inchangé dans l'esprit) : clear `graceTimeout`, et remettre `pendingHiddenLoss = false`.
5. `onVisibilityChange` :

```tsx
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      const map = mapRef.current
      if (!map) return
      if (pendingHiddenLoss) {
        pendingHiddenLoss = false
        if (!graceTimeout) startGrace(map)
        return
      }
      const canvas = map.getCanvas()
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (gl?.isContextLost()) handleContextLoss(map)
    }
```

6. Supprimer `scheduleRebuild` et toute référence à `rebuildTimeout`.

Réécriture de `cookie-map-context-loss.test.tsx` — correspondance test par test :

| Test actuel | Devenir |
|---|---|
| `rebuilds the map when ... not restored in time` | REMPLACÉ par `bascule en raster quand la grâce de 1500ms expire sans restore` (ci-dessous) |
| `restores within the grace window ...` | CONSERVÉ, timings 6000→800 (dans la grâce) et l'attente finale 10000 inchangée |
| `does not rebuild until both ... elapse` | REMPLACÉ par `ne bascule pas à 1499ms, bascule à 1500ms` (ci-dessous) |
| `caches the fetched+recolored style ...` | RÉÉCRIT : le cache se vérifie désormais via « retry-webgl après bascule ne refetche pas » (ci-dessous) |
| `a failed rebuild does not latch ...` | SUPPRIMÉ (plus de rebuild sur perte) — le non-latch du chemin fetch reste couvert par le test `échec du fetch de style` de Task 5 |
| `gives up after 3 consecutive failed attempts` | RÉÉCRIT sur le chemin fetch : `fetch` rejette en continu → 3 tentatives, breaker, écran d'erreur (structure identique, sans phase de perte) |
| `caps the map pixelRatio at 2 ...` | CONSERVÉ tel quel |
| `counts failure retries against the rebuild cap` | SUPPRIMÉ (le mix perte+retry n'existe plus ; le cap fetch est couvert par le test réécrit ci-dessus) |
| `caps loss-triggered rebuilds at 5 ...` | REMPLACÉ par `la 2e perte de la même session bascule immédiatement, sans grâce` (ci-dessous) |
| `clicking the retry button ...` | CONSERVÉ, adapté au chemin fetch (écran d'erreur atteint via fetch KO, retry relance init) |

Le fichier de test réécrit reprend le mock maplibre-gl existant à l'identique et ajoute le stub RasterMap de Task 5 (`vi.mock('../RasterMap', ...)`). Nouveaux tests clés :

```tsx
test('bascule en raster quand la grâce de 1500ms expire sans restore', async () => {
  const { queryByTestId, findByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    // pendant la grâce : pas de teardown, pas de bascule
    expect(removeSpy).not.toHaveBeenCalled()
    expect(queryByTestId('raster-map')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
  } finally {
    vi.useRealTimers()
  }

  await findByTestId('raster-map')
  expect(removeSpy).toHaveBeenCalledTimes(1) // la carte morte est démontée
  expect(mapConstructor).toHaveBeenCalledTimes(1) // JAMAIS de rebuild MapLibre
  expect(localStorage.getItem('cmtl_renderer')).toBe('raster')
})

test('ne bascule pas à 1499ms, bascule à 1500ms', async () => {
  const { queryByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499)
    })
    expect(queryByTestId('raster-map')).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(queryByTestId('raster-map')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('la 2e perte de la même session bascule immédiatement, sans grâce', async () => {
  const { queryByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))
  await waitFor(() => expect(handlers.webglcontextrestored).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    // 1re perte : restaurée dans la grâce — pas de bascule
    act(() => {
      handlers.webglcontextlost()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    act(() => {
      handlers.webglcontextrestored()
    })
    expect(queryByTestId('raster-map')).toBeNull()

    // 2e perte : bascule SYNCHRONE, aucun timer de grâce
    act(() => {
      handlers.webglcontextlost()
    })
    expect(queryByTestId('raster-map')).not.toBeNull()
    expect(removeSpy).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

test('perte onglet caché : aucun décompte en arrière-plan, grâce au retour visible', async () => {
  const { queryByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  const setVisibility = (v: 'hidden' | 'visible') =>
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })

  vi.useFakeTimers()
  try {
    setVisibility('hidden')
    act(() => {
      handlers.webglcontextlost()
    })
    // très au-delà de la grâce, onglet toujours caché : rien ne se passe
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })
    expect(queryByTestId('raster-map')).toBeNull()
    expect(removeSpy).not.toHaveBeenCalled()

    // retour visible : la grâce démarre seulement maintenant
    setVisibility('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(queryByTestId('raster-map')).not.toBeNull()
  } finally {
    vi.useRealTimers()
    setVisibility('visible')
  }
})

test('préchauffe le fallback pendant la grâce (chunk RasterMap + tuiles du viewport)', async () => {
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>
  render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))
  const callsBefore = fetchMock.mock.calls.length

  act(() => {
    handlers.webglcontextlost()
  })

  await waitFor(() => {
    const tileCalls = fetchMock.mock.calls
      .slice(callsBefore)
      .filter(([u]) => typeof u === 'string' && u.includes('/tiles/v1/'))
    expect(tileCalls).toHaveLength(9)
  })
})
```

(Pour ce dernier test, le mock Map doit exposer `getCenter: () => ({ lng: -73.5674, lat: 45.5019 })` et `getZoom: () => 12` — les ajouter au MockMap partagé.)

- [ ] **Step 1: Réécrire `cookie-map-context-loss.test.tsx` selon la table ci-dessus**
- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/cookie-map-context-loss.test.tsx`
Expected: FAIL — les nouveaux comportements n'existent pas (grâce encore à 6000, bascule absente).

- [ ] **Step 3: Implémenter les modifications 1–6 dans CookieMap.tsx**
- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/cookie-map-context-loss.test.tsx src/components/__tests__/cookie-map-raster-switch.test.tsx`
Expected: PASS

- [ ] **Step 5: Suite complète + lint**

Run: `npm test && npm run lint`
Expected: PASS (les tests admin ne touchent pas ce chemin)

- [ ] **Step 6: Commit**

```bash
git add src/components/CookieMap.tsx src/components/__tests__/cookie-map-context-loss.test.tsx
git commit -m "feat: perte WebGL -> bascule raster (grâce 1,5s, préchauffage, 2e perte immédiate)"
```

---

### Task 7: AdminApp — style épuré

**Files:**
- Modify: `src/components/admin/AdminApp.tsx:80` (`map.setStyle(applyPalette(map.getStyle(), theme))`)
- Test: les tests admin existants (`admin-map-stability.test.tsx`, `admin-map-cleanup.test.tsx`)

**Interfaces:**
- Consumes: `buildMapStyle` (Task 1).

- [ ] **Step 1: Remplacer la recoloration**

Dans `AdminApp.tsx`, remplacer l'import `applyPalette` par `buildMapStyle` et ligne ~80 :

```tsx
          map.setStyle(buildMapStyle(map.getStyle(), theme))
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS. Si un test admin mocke/asserte `applyPalette` nommément, adapter le mock à `buildMapStyle` (même signature élargie) sans changer le comportement testé.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminApp.tsx
git commit -m "feat: mini-carte admin sur le style épuré partagé"
```

---

### Task 8: Pipeline `scripts/render-tiles.mjs`

**Files:**
- Create: `scripts/render-tiles.mjs`
- Modify: `.gitignore` (+ `.tiles-out/`, `.tiles-work/`), `package.json` (devDeps + script npm `tiles:render`)
- Test: smoke run (Step 3) — pas de test vitest (script Node autonome ; les conversions Mercator partagées sont déjà testées en Task 3)

**Interfaces:**
- Consumes: `src/lib/map-style.ts` (bundlé via esbuild → `buildMapStyle`), dist maplibre-gl 6.2 de node_modules, Chrome installé.
- Produces: `.tiles-out/tiles/v1/{theme}/{z}/{x}/{y}.webp` ; avec `--upload`, mêmes chemins poussés sur Vercel Blob (`access: 'public'`, `cacheControlMaxAge: 31536000`, `addRandomSuffix: false`, `allowOverwrite: true`). Flags : `--themes=light,dark` (défaut), `--zooms=11-16` (défaut), `--upload` (off par défaut).

- [ ] **Step 1: Installer les devDependencies + script npm**

```bash
npm i -D playwright-core sharp esbuild @vercel/blob
npm pkg set scripts.tiles:render="node scripts/render-tiles.mjs"
```

Ajouter à `.gitignore` :

```
.tiles-out/
.tiles-work/
```

- [ ] **Step 2: Écrire `scripts/render-tiles.mjs`**

Structure complète (industrialisation directe du pipeline de démo validé le 2026-08-08, 8 640 tuiles/0 erreur) :

```js
// scripts/render-tiles.mjs — génère la pyramide raster des deux thèmes depuis le
// style de prod épuré, et (avec --upload) la pousse sur Vercel Blob.
//
// Usage :  node scripts/render-tiles.mjs [--themes=light,dark] [--zooms=11-16] [--upload]
// Prérequis : Google Chrome installé ; pour --upload, BLOB_READ_WRITE_TOKEN dans
// l'environnement (vercel env pull .env.local && export $(grep BLOB .env.local)).
// À relancer uniquement quand la palette, le filtre de couches ou le fond OSM
// changent — bumper alors PATH_VERSION pour invalider le CDN et mettre à jour
// NEXT_PUBLIC_TILES_BASE_URL si le store change.
//
// Pièges maplibre-gl 6.x (appris sur la démo) : ESM-only sans export default
// (`import * as`) ; preserveDrawingBuffer DOIT passer par canvasContextAttributes
// (sinon canvas transparent) ; le worker est résolu via import.meta.url, donc tous
// les fichiers dist doivent être servis depuis le même dossier HTTP.
import { createServer } from 'node:http'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, '.tiles-work')
const OUT = join(ROOT, '.tiles-out')
const PATH_VERSION = 'v1'
const BBOX = { west: -73.75, east: -73.45, south: 45.4, north: 45.62 }
const SLAB = 8 // dalles de 8x8 tuiles (2048px) — les étiquettes ne se coupent qu'aux jointures de dalles
const WEBP_QUALITY = 80

const args = new Map(process.argv.slice(2).map((a) => a.split('=')))
const THEMES = (args.get('--themes') ?? 'light,dark').split(',')
const [zMin, zMax] = (args.get('--zooms') ?? '11-16').split('-').map(Number)
const ZOOMS = Array.from({ length: zMax - zMin + 1 }, (_, i) => zMin + i)
const UPLOAD = args.has('--upload')

// -- même formule que src/lib/tile-math.ts (copie assumée : script Node pur) --
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// 1. bundle du vrai code de style (source unique de vérité)
mkdirSync(WORK, { recursive: true })
await build({
  entryPoints: [join(ROOT, 'src/lib/map-style.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'CmtlMapStyle',
  outfile: join(WORK, 'map-style.iife.js'),
  define: {
    'process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT': JSON.stringify(process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT ?? ''),
    'process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK': JSON.stringify(process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK ?? ''),
  },
})

// 2. fichiers maplibre servis localement (même version exacte que la prod)
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  copyFileSync(join(ROOT, 'node_modules/maplibre-gl/dist', f), join(WORK, f))
}

// 3. page de rendu
writeFileSync(
  join(WORK, 'render.html'),
  `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="maplibre-gl.css">
<style>body{margin:0}#map{width:${SLAB * 256}px;height:${SLAB * 256}px}</style>
</head><body><div id="map"></div>
<script src="map-style.iife.js"></script>
<script type="module">
import * as maplibregl from './maplibre-gl.mjs'
const THEME = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'
let mapReady = (async () => {
  const res = await fetch(CmtlMapStyle.getMapStyleUrl(THEME))
  if (!res.ok) throw new Error('style fetch failed: ' + res.status)
  const style = CmtlMapStyle.buildMapStyle(await res.json(), THEME)
  const map = new maplibregl.Map({
    container: 'map', style, center: [-73.5674, 45.5019], zoom: 11,
    pixelRatio: 1, fadeDuration: 0, attributionControl: false, interactive: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  })
  map.on('error', (e) => { window.__tileErrors = (window.__tileErrors || 0) + 1; console.error('map error', e?.error?.message) })
  await new Promise((ok) => map.once('idle', ok))
  return map
})()
window.renderSlab = async (lng, lat, z) => {
  const map = await mapReady
  map.jumpTo({ center: [lng, lat], zoom: z, bearing: 0, pitch: 0 })
  await new Promise((ok) => map.once('idle', ok))
  await new Promise((ok) => setTimeout(ok, 300))
  return map.getCanvas().toDataURL('image/png')
}
</script></body></html>`
)

// 4. mini serveur statique pour WORK (import.meta.url du worker exige du HTTP)
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  try {
    const file = join(WORK, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'render.html')
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const port = server.address().port

// 5. rendu + découpe
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: SLAB * 256 + 100, height: SLAB * 256 + 100 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()) })
let total = 0
for (const theme of THEMES) {
  await page.goto(`http://127.0.0.1:${port}/render.html?theme=${theme}`)
  await page.waitForFunction('typeof window.renderSlab === "function"')
  console.log(`=== thème ${theme} ===`)
  for (const z of ZOOMS) {
    const x0 = Math.floor(lon2x(BBOX.west, z)), x1 = Math.floor(lon2x(BBOX.east, z))
    const y0 = Math.floor(lat2y(BBOX.north, z)), y1 = Math.floor(lat2y(BBOX.south, z))
    for (let sx = x0; sx <= x1; sx += SLAB) {
      for (let sy = y0; sy <= y1; sy += SLAB) {
        const dataUrl = await page.evaluate(
          ([lng, lat, mz]) => window.renderSlab(lng, lat, mz),
          [x2lon(sx + SLAB / 2, z), y2lat(sy + SLAB / 2, z), z - 1] // zoom MapLibre = zoom Leaflet - 1
        )
        const slab = sharp(Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'))
        for (let i = 0; i < SLAB; i++) {
          for (let j = 0; j < SLAB; j++) {
            const tx = sx + i, ty = sy + j
            if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue
            const file = join(OUT, 'tiles', PATH_VERSION, theme, String(z), String(tx), `${ty}.webp`)
            mkdirSync(dirname(file), { recursive: true })
            writeFileSync(file, await slab.clone().extract({ left: i * 256, top: j * 256, width: 256, height: 256 }).webp({ quality: WEBP_QUALITY }).toBuffer())
            total++
          }
        }
      }
    }
    console.log(`  ${theme} z${z} ok — ${total} tuiles cumulées`)
  }
}
const errors = await page.evaluate('window.__tileErrors || 0')
await browser.close()
server.close()
console.log(`RENDU TERMINÉ: ${total} tuiles, ${errors} erreurs de rendu`)
if (errors > 0) process.exit(1)

// 6. upload Blob (optionnel)
if (UPLOAD) {
  const { put } = await import('@vercel/blob')
  const { readdirSync, statSync } = await import('node:fs')
  const files = []
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      statSync(p).isDirectory() ? walk(p) : files.push(p)
    }
  }
  walk(join(OUT, 'tiles'))
  console.log(`upload de ${files.length} tuiles vers Vercel Blob…`)
  let uploaded = 0
  const CONCURRENCY = 12
  const queue = [...files]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const pathname = f.slice(OUT.length + 1).replaceAll('\\', '/')
        await put(pathname, readFileSync(f), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 31536000,
          contentType: 'image/webp',
        })
        uploaded++
        if (uploaded % 500 === 0) console.log(`  ${uploaded}/${files.length}`)
      }
    })
  )
  console.log(`UPLOAD TERMINÉ: ${uploaded} tuiles`)
}
```

- [ ] **Step 3: Smoke test local (sans upload)**

Run: `node scripts/render-tiles.mjs --themes=light --zooms=11-12`
Expected: `RENDU TERMINÉ: 29 tuiles, 0 erreurs` (9 tuiles z11 + 20 z12) ; vérifier qu'une tuile s'ouvre et n'est pas transparente :
`node -e "require('sharp')('.tiles-out/tiles/v1/light/12/1210/1464.webp').stats().then(s=>console.log(s.channels.map(c=>c.stdev.toFixed(1))))"` → stdev > 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/render-tiles.mjs .gitignore package.json package-lock.json
git commit -m "feat: pipeline de génération/upload des tuiles pré-rendues"
```

---

### Task 9: Génération réelle, Blob, env, vérification bout-en-bout

**Files:**
- Modify: `README.md` (section « Tuiles du fallback raster » : quand régénérer, commandes, env vars)
- Env: `.env.local` + variables Vercel (`NEXT_PUBLIC_TILES_BASE_URL`, `BLOB_READ_WRITE_TOKEN`)

**Interfaces:**
- Consumes: script Task 8, store Vercel Blob du projet `zucchini-studio/cookies-mtl`.

- [ ] **Step 1: Créer le store Blob et récupérer le token**

```bash
vercel link --yes --project cookies-mtl --scope team_17Hgqho7vAKdnbJpBa21o4Ze
vercel blob store add cookies-mtl-tiles
vercel env pull .env.local
```

(`vercel blob store add` connecte le store au projet et crée `BLOB_READ_WRITE_TOKEN`. Si la CLI demande une confirmation interactive, la faire faire à Léo via `! vercel blob store add cookies-mtl-tiles`.)

- [ ] **Step 2: Génération complète + upload**

```bash
node scripts/render-tiles.mjs --upload
```

Expected: `RENDU TERMINÉ: ~8640 tuiles, 0 erreurs` puis `UPLOAD TERMINÉ`. Récupérer l'URL de base du store (affichée par `vercel blob store get cookies-mtl-tiles`, forme `https://<id>.public.blob.vercel-storage.com`).

- [ ] **Step 3: Configurer `NEXT_PUBLIC_TILES_BASE_URL`**

```bash
vercel env add NEXT_PUBLIC_TILES_BASE_URL production   # coller l'URL du store
vercel env add NEXT_PUBLIC_TILES_BASE_URL preview
echo "NEXT_PUBLIC_TILES_BASE_URL=https://<id>.public.blob.vercel-storage.com" >> .env.local
```

- [ ] **Step 4: Vérification bout-en-bout en dev**

1. `npm run dev`
2. Dans le navigateur : `localStorage.setItem('cmtl_renderer','raster')` puis recharger → la carte raster s'affiche avec les tuiles Blob (thème clair ET sombre via l'OS), pins cliquables, ShopSheet OK, lien « Réessayer la carte détaillée » → revient à MapLibre.
3. `curl -sI "$NEXT_PUBLIC_TILES_BASE_URL/tiles/v1/light/13/2421/2929.webp"` → `200`, `content-type: image/webp`, `cache-control` long.

- [ ] **Step 5: README + commit**

Ajouter au README une section « Tuiles du fallback raster » : rôle, `npm run tiles:render -- --upload`, quand régénérer (changement de palette/filtre/fond), bump de `PATH_VERSION`, les deux env vars.

```bash
git add README.md
git commit -m "docs: génération et hébergement des tuiles du fallback raster"
```

---

### Task 10: Revue finale et PR

- [ ] **Step 1: Suite complète**

Run: `npm test && npm run lint && npm run build`
Expected: tout passe.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feature/carte-hybride-raster
gh pr create --base main --title "Carte hybride : style épuré partagé + fallback raster sans WebGL" --body "Implémente docs/superpowers/specs/2026-08-08-carte-hybride-raster-design.md : buildMapStyle (simplify+palette+halo) partagé par CookieMap/AdminApp/pipeline, RasterMap Leaflet sur tuiles pré-rendues (Vercel Blob), bascule instantanée mémorisée (init raté -> immédiat ; grâce 1,5s + préchauffage ; 2e perte -> immédiat ; localStorage cmtl_renderer), pipeline scripts/render-tiles.mjs."
```

- [ ] **Step 3: Vérifier le check Vercel sur la PR, puis demander la revue/merge à Léo**

Sur la preview Vercel : tester la carte normale (style épuré appliqué) ET le mode raster forcé (`localStorage.setItem('cmtl_renderer','raster')`). Le test XS Max réel de Léo reste le juge de paix après merge.

---

## Self-Review (fait à la rédaction)

- **Couverture spec** : §1 style partagé → T1/T5/T7/T8 ; §2 carte principale → T5 ; §3 RasterMap → T4 ; §4 détection/bascule/mémoire/retry → T5/T6 ; §5 pipeline+Blob+env → T8/T9 ; tests spec → T1–T6 ; hors-scope respecté (pas de fallback admin, pas de toggle manuel, pas de CI tuiles).
- **Placeholders** : aucun TBD ; chaque step a son code ou sa commande exacte.
- **Cohérence de types** : `buildMapStyle(style, theme)` identique en T1/T5/T7/T8 ; `preferredRenderer/markRasterPreferred/clearRasterPreference` identiques en T2/T5/T6 ; `viewportTileUrls(base, theme, lng, lat, zoom)` identique en T3/T6 ; chemin `tiles/v1/{theme}/{z}/{x}/{y}.webp` identique en T3/T4/T8/T9.
- **Géolocalisation RasterMap** (spec §3) : incluse en Task 4 (contrôle Leaflet minimal, position simple sans suivi).
