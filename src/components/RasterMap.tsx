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
      L.tileLayer(`${TILES_BASE}/tiles/v1/${theme}/{z}/{x}/{y}.webp`, {
        minZoom: 11,
        maxNativeZoom: 16, // au-delà : sur-zoom (agrandissement de la tuile z16)
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · style Cookies MTL',
      }).addTo(map)

      for (const shop of shops) {
        // Mêmes pins DOM que la carte MapLibre : la classe .cmtl-pin de globals.css
        // s'applique telle quelle (thème via prefers-color-scheme, comme partout).
        const icon = L.divIcon({
          className: '',
          html: `<span class="cmtl-pin" role="button" aria-label="${shop.name.replaceAll('"', '&quot;')}"></span>`,
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
