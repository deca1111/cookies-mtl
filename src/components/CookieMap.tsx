'use client'

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/lib/maplibre-setup'
import { useEffect, useRef, useState } from 'react'
import { currentTheme, getMapStyleUrl, applyPalette } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { useLang } from './LangProvider'
import { ShopSheet } from './ShopSheet'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

export function CookieMap({ shops, initialSlug }: { shops: Shop[]; initialSlug?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selected, setSelected] = useState<Shop | null>(
    initialSlug ? (shops.find((s) => s.slug === initialSlug) ?? null) : null
  )
  const [mapError, setMapError] = useState(false)
  const { t, lang, setLang } = useLang()

  // Kept in sync below so the mount-only effect (deps: []) can read the CURRENT selected
  // shop when rebuilding the map after a WebGL context loss, instead of the stale value
  // it originally closed over.
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    if (!containerRef.current) return
    const theme = currentTheme()
    let cancelled = false
    let rebuilding = false
    // Fix round 1 (task 17b review): bounds automatic rebuild cycles so a failed retry
    // can't spin forever, and doubles as the circuit breaker the reviewer flagged as
    // missing for repeated context losses. Reset to 0 on a successful init; a run of 3
    // consecutive failures (initial load or rebuild, doesn't matter which) stops
    // scheduling further retries — the mapError screen stays up until something external
    // changes (network back, manual reload, another webglcontextlost/visibilitychange).
    let failureCount = 0
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    async function init() {
      try {
        const res = await fetch(getMapStyleUrl(theme))
        if (!res.ok) throw new Error('style fetch failed')
        const style = applyPalette(await res.json(), theme)
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: selectedRef.current ? [selectedRef.current.lng, selectedRef.current.lat] : MTL_CENTER,
          zoom: selectedRef.current ? 15 : 12,
          attributionControl: { compact: true },
        })
        mapRef.current = map
        failureCount = 0
        setMapError(false)

        // top-left: bottom-right sits under the bottom sheet on mobile once a shop is
        // selected, and top-right is already the FR/EN toggle — top-left stays reachable
        // in both states.
        map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-left')

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

        // Task 17b bug 1: mobile OSes reclaim GPU memory from backgrounded tabs (and cap
        // simultaneous live WebGL contexts, ~8 on iOS Safari), which can leave this map's
        // canvas dead — MapLibre surfaces that as a `webglcontextlost` map event. Recover by
        // tearing the dead map down and rebuilding from scratch via this same `init()` path;
        // simplest reliable recovery, and `selectedRef` carries the current selection across
        // the rebuild.
        map.on('webglcontextlost', () => {
          if (cancelled || rebuilding) return
          rebuilding = true
          map.remove()
          if (mapRef.current === map) mapRef.current = null
          init()
        })
      } catch {
        if (!cancelled) {
          setMapError(true)
          failureCount += 1
          // Fix round 1: the original code only reset `rebuilding` on the SUCCESS path
          // (right after `mapRef.current = map`), so a rebuild whose retry also failed
          // left `rebuilding` stuck `true` forever — no live map left to ever fire another
          // `webglcontextlost`, and `onVisibilityChange` bailed on the flag on every future
          // check. Schedule one bounded retry instead of just giving up silently.
          if (failureCount < 3) {
            retryTimeout = setTimeout(() => {
              retryTimeout = null
              if (!cancelled) init()
            }, 3000)
          }
        }
      } finally {
        // Always reset — on success (redundant with the reset above, harmless) AND on
        // failure, so a later external trigger (webglcontextlost on a map that did end up
        // getting built some other way, or visibilitychange) is never permanently blocked
        // by a stale `true` left over from this attempt.
        rebuilding = false
      }
    }
    init()

    // Defense in depth: some mobile browsers suppress `webglcontextlost` while the tab is
    // hidden and only leave the dead canvas discoverable once the tab is foregrounded again.
    // Re-check on visibilitychange and rebuild if the canvas reports its context lost.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || rebuilding) return
      const map = mapRef.current
      if (!map) return
      const canvas = map.getCanvas()
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (gl?.isContextLost()) {
        rebuilding = true
        map.remove()
        mapRef.current = null
        init()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
