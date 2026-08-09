'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { currentTheme } from '@/lib/map-style'
import { onThemeChange } from '@/lib/theme'
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
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null)
  const { t } = useLang()

  // Le composant est monté une fois par session raster ; la sélection vit dans
  // CookieMap (mêmes raisons que l'effet unique de la carte MapLibre). selectedRef
  // n'est pas nécessaire ici : pas de rebuild interne.
  const initialSelected = useRef(selected)

  useEffect(() => {
    if (!containerRef.current) return
    const theme = currentTheme()
    let cancelled = false
    let map: import('leaflet').Map | null = null

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      const sel = initialSelected.current
      map = L.map(containerRef.current, { zoomControl: true }).setView(
        sel ? [sel.lat, sel.lng] : MTL_CENTER,
        sel ? 15 : 12
      )
      map.setMaxBounds(MTL_BOUNDS)
      const layer = L.tileLayer(`${TILES_BASE}/tiles/v1/${theme}/{z}/{x}/{y}.webp`, {
        minZoom: 11,
        maxNativeZoom: 16, // au-delà : sur-zoom (agrandissement de la tuile z16)
        maxZoom: 18,
        // ne demander QUE les tuiles intersectant la zone pré-rendue — sans ça, un
        // viewport large à faible zoom demande des tuiles hors pyramide (404)
        bounds: MTL_BOUNDS,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · style Cookies Club',
      })
      tileLayerRef.current = layer
      layer.addTo(map)

      for (const shop of shops) {
        // Mêmes pins DOM que la carte MapLibre : la classe .cmtl-pin de globals.css
        // s'applique telle quelle (thème via prefers-color-scheme, comme partout).
        // vrai <button> comme sur MapLibre : focusable, activable clavier, mêmes
        // styles .cmtl-pin (hover/focus-visible compris)
        const icon = L.divIcon({
          className: '',
          html: `<button class="cmtl-pin" aria-label="${shop.name.replaceAll('"', '&quot;')}"></button>`,
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        })
        L.marker([shop.lat, shop.lng], { icon })
          .addTo(map)
          .on('click', () => {
            onSelect(shop)
            // même comportement que easeTo({center}) sur MapLibre : recentrer sans
            // changer le zoom
            map?.panTo([shop.lat, shop.lng])
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
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'
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

  // Bascule de pyramide au toggle (les deux thèmes de tuiles sont pré-rendus).
  useEffect(() => {
    return onThemeChange((theme) => {
      tileLayerRef.current?.setUrl(`${TILES_BASE}/tiles/v1/${theme}/{z}/{x}/{y}.webp`)
    })
  }, [])

  return (
    // isolate + z-0 : confine les z-index internes de Leaflet (panes 400, markers
    // 600, contrôles 1000) dans ce stacking context — sans ça ils passaient
    // au-dessus de la ShopSheet (z-20, fixed) qui s'ouvrait invisible sous la carte.
    <div className="relative isolate z-0 h-full w-full">
      {/* Fond au ton du thème : au-delà de la zone pré-rendue, la carte fond dans le
          crème/chocolat au lieu du gris Leaflet. Style INLINE obligatoirement :
          leaflet.css pose `background:#ddd` sur .leaflet-container (classe ajoutée
          par L.map à ce div) et gagnerait sur toute classe utilitaire. */}
      <div ref={containerRef} className="h-full w-full" style={{ background: 'var(--bg)' }} />
      <button
        onClick={onRetryWebgl}
        className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[12px] text-[color:var(--text-muted)] shadow-[var(--shadow-chip)] transition-colors hover:text-[color:var(--text-body)]"
      >
        {t('retryDetailedMap')}
      </button>
    </div>
  )
}
