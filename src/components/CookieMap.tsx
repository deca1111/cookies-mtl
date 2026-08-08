'use client'

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { getMapStyleUrl, applyPalette, type MapTheme } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { useLang } from './LangProvider'
import { ShopSheet } from './ShopSheet'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

function currentTheme(): MapTheme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function CookieMap({ shops, initialSlug }: { shops: Shop[]; initialSlug?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selected, setSelected] = useState<Shop | null>(
    initialSlug ? (shops.find((s) => s.slug === initialSlug) ?? null) : null
  )
  const [mapError, setMapError] = useState(false)
  const { t, lang, setLang } = useLang()

  useEffect(() => {
    if (!containerRef.current) return
    const theme = currentTheme()
    let cancelled = false

    async function init() {
      try {
        const res = await fetch(getMapStyleUrl(theme))
        if (!res.ok) throw new Error('style fetch failed')
        const style = applyPalette(await res.json(), theme)
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: selected ? [selected.lng, selected.lat] : MTL_CENTER,
          zoom: selected ? 15 : 12,
          attributionControl: { compact: true },
        })
        mapRef.current = map

        map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'bottom-right')

        for (const shop of shops) {
          const el = document.createElement('button')
          el.className = 'cmtl-pin'
          el.setAttribute('aria-label', shop.name)
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            setSelected(shop)
            map.easeTo({ center: [shop.lng, shop.lat] })
          })
          new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([shop.lng, shop.lat]).addTo(map)
        }
        map.on('click', () => setSelected(null))
      } catch {
        if (!cancelled) setMapError(true)
      }
    }
    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--bg)] p-8 text-center">
          <p className="max-w-xs text-[15px] leading-relaxed text-[color:var(--text-body)]">{t('mapUnavailable')}</p>
        </div>
      )}
      <button
        onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.14em] text-[color:var(--text-body)] shadow-[var(--shadow-chip)] transition-colors hover:bg-[color:var(--surface-2)]"
        aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
      >
        {lang === 'fr' ? 'EN' : 'FR'}
      </button>
      {selected && <ShopSheet shop={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
