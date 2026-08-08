'use client'

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/lib/maplibre-setup'
import { useEffect, useRef, useState } from 'react'
import { currentTheme, getMapStyleUrl, applyPalette, type MapTheme } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { useLang } from './LangProvider'
import { ShopSheet } from './ShopSheet'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

// Fix round 2 (iPhone incident: .superpowers/sdd/2026-08-07-cookies-mtl/incident-iphone-evidence.md).
// Fix round 1's `failureCount < 3` breaker only bounds consecutive FAILED init() calls — it
// resets to 0 on every successful init, so it never engages for a success->loss->success
// flapping loop. On a mobile device flapping in and out of GPU memory pressure, every
// `webglcontextlost` triggered an immediate, undamped, full rebuild (style fetch + tiles +
// markers) with no delay and no cap on total rebuilds — unbounded cost until iOS Safari killed
// the page. These two constants damp and cap loss-/visibility-triggered rebuilds specifically;
// they compose with (don't replace) the existing failed-init retry logic.
const REBUILD_COOLDOWN_MS = 2000
// Bounds ALL automatic re-init attempts per mount: loss-triggered rebuilds (damped via the
// cooldown above) AND failure retries (from catch block). Composes with the independent
// failureCount < 3 check — a loss-triggered rebuild that itself fails is still retried under
// the existing consecutive-failure breaker, but only if rebuildCount permits.
const MAX_REBUILDS_PER_MOUNT = 5

// Round 3 (iPhone incident, footprint reduction continued — see
// .superpowers/sdd/2026-08-07-cookies-mtl/incident-iphone-evidence.md, "Round 3"). MapLibre
// itself already has a built-in, zero-network webglcontextlost/webglcontextrestored recovery
// path: it saves the in-memory style before tearing down the WebGL context, then restores from
// that saved copy on `webglcontextrestored` — no refetch, no new Map/Painter/context. Our own
// scheduleRebuild path used to run unconditionally on every webglcontextlost, discarding that
// cheap built-in path before the browser ever got a chance to use it, and plausibly adding to
// the very memory pressure causing repeated losses. RESTORE_GRACE_MS gives MapLibre's own
// recovery a bounded window to fire `webglcontextrestored` first; only if it doesn't do we fall
// back to the existing damped/capped scheduleRebuild path.
const RESTORE_GRACE_MS = 6000

// Round 3: `maxTileCacheSize` left unset defaults to a dynamically-sized cache that scales with
// the viewport in device pixels (`maxTileCacheZoomLevels`, default 5, x approximate tiles
// visible) — this is the exact mechanism behind mapbox/mapbox-gl-js#4052's documented iOS OOM
// crashes (unbounded cache growth during ordinary panning/zooming on memory-constrained
// devices). 40 sits in the middle of a mobile-safe 32-64 range: comfortably above what's ever
// visible in a single iPhone viewport at once (roughly 10-20 tiles at pixelRatio 2, the Round 2
// cap) so ordinary panning/zooming around Montreal doesn't thrash the cache, while still
// bounding worst-case memory far below the uncapped, viewport-and-DPR-scaled default.
const MAX_TILE_CACHE_SIZE = 40

// Round 3: fetching + JSON-parsing + recoloring the ~123-layer OpenFreeMap style is real
// network + CPU work that used to re-run from scratch on every context-loss-triggered rebuild,
// even though the style itself never changes within a session. Cache the FINAL recolored style
// object per (theme, url) at module scope so it survives across rebuilds/retries within a mount
// and across separate mounts (e.g. the error screen's retry button, or a second CookieMap
// instance sharing the tab). MapLibre does not mutate the style object it's handed, so the same
// object can safely be reused by more than one `new Map({style})` call.
const styleCache = new Map()

async function getRecoloredStyle(theme: MapTheme, url: string) {
  const key = `${theme}:${url}`
  if (styleCache.has(key)) return styleCache.get(key)
  const res = await fetch(url)
  if (!res.ok) throw new Error('style fetch failed')
  const style = applyPalette(await res.json(), theme)
  styleCache.set(key, style)
  return style
}

// Test-only escape hatch: the cache above is intentionally module-scoped (not per-mount) so
// production rebuilds/retries reuse it, but that means it would otherwise persist across every
// test in cookie-map-context-loss.test.tsx, silently skipping the fetch mock those tests rely
// on. Production code never calls this.
export function __clearStyleCacheForTests() {
  styleCache.clear()
}

export function CookieMap({ shops, initialSlug }: { shops: Shop[]; initialSlug?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selected, setSelected] = useState<Shop | null>(
    initialSlug ? (shops.find((s) => s.slug === initialSlug) ?? null) : null
  )
  const [mapError, setMapError] = useState(false)
  // Round 2 — footprint reduction: bumped by the retry button on the error screen, mirroring
  // AdminApp's draftSession pattern. It's the main effect's only dependency, so bumping it
  // re-runs the whole effect — cleanup tears down whatever's left, then the effect body
  // starts over with fresh closured counters (failureCount, rebuildCount, etc. are `let`s
  // local to the effect, so a re-run gets a clean budget for free) and calls init() again.
  const [mapSession, setMapSession] = useState(0)
  const { t, lang, setLang } = useLang()

  // Kept in sync below so the map effect (deps: [mapSession]) can read the CURRENT selected
  // shop when rebuilding the map after a WebGL context loss, instead of the stale value
  // it originally closed over.
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  // Round 2 — footprint reduction: lets the error screen's retry button get back to a live
  // map without a full page reload. Clearing mapError here makes the overlay disappear
  // immediately (init() would also clear it on success, but that's async); bumping
  // mapSession re-runs the main effect with a fresh rebuild/failure budget.
  const retry = () => {
    setMapError(false)
    setMapSession((s) => s + 1)
  }

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
    // Fast-follow: split into separate timers to allow clearing each independently and
    // ensure no cross-talk between rebuild cooldown and failure-retry backoff.
    let rebuildTimeout: ReturnType<typeof setTimeout> | null = null
    let failureRetryTimeout: ReturnType<typeof setTimeout> | null = null
    // Round 3: pending "give MapLibre's own webglcontextrestored a chance" window. Set by
    // handleContextLoss when a loss is first observed, cleared either by webglcontextrestored
    // firing (recovered for free, in-memory, no network — nothing else to do) or by its own
    // timeout firing (falls back to scheduleRebuild). Its truthiness also guards against
    // starting a second, overlapping grace window if webglcontextlost/visibilitychange fire
    // again while one is already pending.
    let graceTimeout: ReturnType<typeof setTimeout> | null = null
    // Counts every loss-/visibility-triggered rebuild attempt (scheduled, not necessarily
    // successful) — never reset within the mount, unlike `failureCount`. This is what actually
    // bounds the success->loss->success flapping loop from the iPhone incident.
    let rebuildCount = 0

    // Round 3: entry point for BOTH the webglcontextlost handler and the visibilitychange
    // fallback (previously each called scheduleRebuild directly). Defers to MapLibre's own
    // built-in, zero-network context recovery first: starts a bounded grace window instead of
    // tearing the map down immediately. If webglcontextrestored fires within the window, the
    // map.on('webglcontextrestored', ...) handler registered in init() clears graceTimeout and
    // nothing else happens. Only once the window elapses without a restore do we fall back to
    // the existing damped/capped scheduleRebuild path.
    function handleContextLoss(map: maplibregl.Map) {
      if (cancelled || rebuilding || graceTimeout) return
      graceTimeout = setTimeout(() => {
        graceTimeout = null
        scheduleRebuild(map)
      }, RESTORE_GRACE_MS)
    }

    // Shared fallback used by handleContextLoss once its grace window elapses without a
    // restore: tears the dead map down (nothing left to preserve — MapLibre's own recovery
    // window already passed), then either schedules a damped rebuild or, once
    // MAX_REBUILDS_PER_MOUNT is reached, gives up and shows the error state instead of
    // scheduling another one.
    function scheduleRebuild(map: maplibregl.Map) {
      if (cancelled || rebuilding) return
      rebuilding = true
      map.remove()
      if (mapRef.current === map) mapRef.current = null

      if (rebuildCount >= MAX_REBUILDS_PER_MOUNT) {
        setMapError(true)
        rebuilding = false
        return
      }
      rebuildCount += 1
      if (rebuildTimeout) clearTimeout(rebuildTimeout)
      rebuildTimeout = setTimeout(() => {
        rebuildTimeout = null
        if (!cancelled) init()
        else rebuilding = false
      }, REBUILD_COOLDOWN_MS)
    }

    async function init() {
      try {
        // Round 3: reuse the cached, already-fetched-and-recolored style across
        // rebuilds/retries instead of refetching + re-parsing + re-recoloring 123 layers every
        // time (see getRecoloredStyle's own comment).
        const style = await getRecoloredStyle(theme, getMapStyleUrl(theme))
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: selectedRef.current ? [selectedRef.current.lng, selectedRef.current.lat] : MTL_CENTER,
          zoom: selectedRef.current ? 15 : 12,
          attributionControl: { compact: true },
          // Round 2 — footprint reduction (iPhone incident): rendering at devicePixelRatio 3
          // (real value on modern iPhones) roughly triples the GPU memory footprint of a
          // devicePixelRatio-1 canvas vs. capping at 2. That extra memory pressure is the
          // prime hypothesis for the repeated webglcontextlost losses on the user's iPhone.
          // Standard MapLibre mitigation: cap the render pixel ratio at 2 — still crisp on
          // retina screens, without the devicePixelRatio-3 memory cost.
          pixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
          // Round 3 — see MAX_TILE_CACHE_SIZE's own comment for the value rationale.
          maxTileCacheSize: MAX_TILE_CACHE_SIZE,
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

        // Task 17b bug 1 / Round 3: mobile OSes reclaim GPU memory from backgrounded tabs (and
        // cap simultaneous live WebGL contexts, ~8 on iOS Safari), which can leave this map's
        // canvas dead — MapLibre surfaces that as a `webglcontextlost` map event. MapLibre
        // itself already tries to recover for free first (in-memory `setStyle` from a saved
        // copy — no network refetch); calling scheduleRebuild synchronously here would discard
        // that cheap built-in path before the browser gets a chance to use it. Defer instead:
        // enter the bounded grace window via handleContextLoss, and only fall back to the full
        // damped/capped rebuild if MapLibre's own recovery doesn't fire in time. `selectedRef`
        // still carries the current selection across a fallback rebuild if one does happen.
        map.on('webglcontextlost', () => {
          handleContextLoss(map)
        })
        map.on('webglcontextrestored', () => {
          if (graceTimeout) {
            clearTimeout(graceTimeout)
            graceTimeout = null
          }
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
          // Fast-follow: count failure retries against the rebuild cap. Only schedule a
          // retry if we have both capacity (rebuildCount < cap) and haven't hit the
          // consecutive-failure limit (failureCount < 3).
          if (failureCount < 3 && rebuildCount < MAX_REBUILDS_PER_MOUNT) {
            rebuildCount += 1
            if (failureRetryTimeout) clearTimeout(failureRetryTimeout)
            failureRetryTimeout = setTimeout(() => {
              failureRetryTimeout = null
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
        // Round 3: route through the same loss-entry logic as webglcontextlost instead of
        // scheduling a rebuild directly — gives MapLibre's own recovery the same bounded grace
        // window even when the loss is only noticed on returning to the tab.
        handleContextLoss(map)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      if (graceTimeout) clearTimeout(graceTimeout)
      if (rebuildTimeout) clearTimeout(rebuildTimeout)
      if (failureRetryTimeout) clearTimeout(failureRetryTimeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSession])

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[color:var(--bg)] p-8 text-center">
          <p className="max-w-xs text-[15px] leading-relaxed text-[color:var(--text-body)]">{t('mapUnavailable')}</p>
          <button
            onClick={retry}
            className="rounded-full bg-[color:var(--btn-bg)] px-5 py-2.5 text-[14px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)]"
          >
            {t('retry')}
          </button>
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
