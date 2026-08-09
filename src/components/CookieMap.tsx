'use client'

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/lib/maplibre-setup'
import { useEffect, useRef, useState } from 'react'
import { currentTheme, getMapStyleUrl, buildMapStyle, type MapTheme } from '@/lib/map-style'
import { preferredRenderer, markRasterPreferred, clearRasterPreference } from '@/lib/map-renderer'
import { viewportTileUrls } from '@/lib/tile-math'
import { SHEET_CAMERA_OFFSET_Y, shopFocusZoom } from '@/lib/camera'
import { applyMarkerSelection, cookieMarkerHtml } from '@/lib/cookie-marker'
import { onThemeChange } from '@/lib/theme'
import type { Shop } from '@/lib/shops'
import { useLang } from './LangProvider'
import { INTRO_SEEN_KEY, IntroPopup } from './IntroPopup'
import { MapChrome } from './MapChrome'
import { RasterMap } from './RasterMap'
import { ShopListPanel } from './ShopListPanel'
import { ShopSheet } from './ShopSheet'
import { ThemeToggle } from './ThemeToggle'
import { IconList } from './icons'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

// Borne les retries d'ÉCHEC D'INIT (fetch de style raté — souci réseau) par mount.
// Depuis la bascule raster (spec carte hybride), c'est son seul rôle : les pertes de
// contexte WebGL ne déclenchent plus jamais de rebuild MapLibre, elles basculent vers
// le fallback Leaflet (voir handleContextLoss).
const MAX_REBUILDS_PER_MOUNT = 5

// Spec carte hybride §4 : fenêtre laissée au restore natif de MapLibre (in-memory,
// zéro réseau) après une perte de contexte, AVANT de basculer vers le fallback
// raster. Le restore utile tire en ~1 s ; l'issue de secours étant une bascule bon
// marché et visuellement jumelle (plus un rebuild coûteux comme au round 3, qui
// justifiait 6 s), 1,5 s suffit — au-delà, on fait attendre l'utilisateur devant un
// canvas gelé pour rien. L'horloge ne court qu'onglet visible, et le fallback est
// préchauffé en parallèle (warmRasterFallback) pour une bascule quasi instantanée.
const RESTORE_GRACE_MS = 1500

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
  const style = buildMapStyle(await res.json(), theme)
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
  // Spec carte hybride §4 : quel moteur de rendu sert la carte. `'raster'` est
  // choisi dès que WebGL échoue (init ou pertes répétées) et mémorisé, si possible,
  // via localStorage — les visites suivantes ne chargent alors plus MapLibre du tout.
  // `null` = pas encore décidé : le SSR et le premier rendu client affichent le même
  // conteneur vide, la préférence (localStorage) n'est lue qu'après montage — lire
  // localStorage dans l'initialiseur du useState créait un mismatch d'hydratation
  // (React #418) dès que la préférence différait du rendu serveur.
  const [renderer, setRenderer] = useState<'webgl' | 'raster' | null>(null)
  useEffect(() => {
    // Hydratation volontaire, même motif que LangProvider : décision client
    // post-montage à partir d'un état serveur neutre.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderer(preferredRenderer())
  }, [])
  // Round 2 — footprint reduction: bumped by the retry button on the error screen, mirroring
  // AdminApp's draftSession pattern. It's the main effect's only dependency, so bumping it
  // re-runs the whole effect — cleanup tears down whatever's left, then the effect body
  // starts over with fresh closured counters (failureCount, rebuildCount, etc. are `let`s
  // local to the effect, so a re-run gets a clean budget for free) and calls init() again.
  const [mapSession, setMapSession] = useState(0)
  const [introOpen, setIntroOpen] = useState(false)
  // 'auto' (1re visite) : pas d'animation d'entrée ; 'logo' : la popup naît du logo.
  const [introOrigin, setIntroOrigin] = useState<'auto' | 'logo'>('logo')
  const [listOpen, setListOpen] = useState(false)
  const { t } = useLang()

  // Popup explicative : auto-ouverture à la première visite uniquement (spec v1.2 §5).
  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO_SEEN_KEY)) {
        // Hydratation volontaire, même motif que le renderer : décision client post-montage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIntroOrigin('auto')
        setIntroOpen(true)
        localStorage.setItem(INTRO_SEEN_KEY, '1')
      }
    } catch {
      /* localStorage indisponible : pas d'auto-ouverture, le logo reste la porte d'entrée */
    }
  }, [])

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

  // Bascule vers le fallback Leaflet : mémorise le choix (au mieux localStorage,
  // sinon session) et démonte l'écran d'erreur éventuel — la bascule EST la
  // réponse à l'échec, pas un message.
  const switchToRaster = () => {
    markRasterPreferred()
    setMapError(false)
    setRenderer('raster')
  }
  // Porte de sortie du raster (lien « Réessayer la carte détaillée ») : efface la
  // préférence et retente MapLibre avec un budget de retries frais.
  const retryWebgl = () => {
    clearRasterPreference()
    setRenderer('webgl')
    setMapSession((s) => s + 1)
  }

  useEffect(() => {
    if (renderer !== 'webgl') return
    if (!containerRef.current) return
    const theme = currentTheme()
    let cancelled = false
    // Fix round 1 (task 17b review) : borne les retries consécutifs d'échec d'init
    // (fetch de style). Reset à 0 sur un init réussi.
    let failureCount = 0
    let failureRetryTimeout: ReturnType<typeof setTimeout> | null = null
    // Fenêtre « laisse au restore natif sa chance » (spec §4). Posée par startGrace,
    // levée par webglcontextrestored (récupération gratuite, rien d'autre à faire) ou
    // par sa propre échéance (bascule raster). Sa véracité empêche une seconde
    // fenêtre de se superposer.
    let graceTimeout: ReturnType<typeof setTimeout> | null = null
    // Compte les tentatives de retry d'échec d'init — jamais reset dans le mount.
    let rebuildCount = 0
    // Nombre de pertes de contexte observées dans la session de carte courante : la
    // 1re a droit à la grâce, la 2e bascule immédiatement (le restore natif a déjà
    // eu sa chance, et le fallback est déjà préchauffé).
    let lossCount = 0
    // Perte survenue onglet caché : cas bénin typique (iOS reprend le GPU en
    // arrière-plan, restore gratuit au retour). On ne fait ni basculer ni décompter
    // en arrière-plan — la grâce court à partir du retour visible.
    let pendingHiddenLoss = false

    // Spec §4 : pendant la grâce on préchauffe le fallback (chunk Leaflet + 9 tuiles
    // du viewport) pour que la bascule, si elle a lieu, soit quasi instantanée. Si le
    // restore natif gagne, on n'a dépensé que quelques Ko.
    function warmRasterFallback(map: maplibregl.Map) {
      import('./RasterMap').catch(() => {})
      const base = process.env.NEXT_PUBLIC_TILES_BASE_URL ?? ''
      const c = map.getCenter()
      for (const url of viewportTileUrls(base, currentTheme(), c.lng, c.lat, map.getZoom())) {
        fetch(url).catch(() => {})
      }
    }

    function startGrace(map: maplibregl.Map) {
      graceTimeout = setTimeout(() => {
        graceTimeout = null
        if (cancelled) return
        // Grâce écoulée sans restore : le contexte est considéré irrécupérable sur
        // cet appareil — démonte la carte morte et bascule. Plus JAMAIS de rebuild
        // MapLibre sur perte (l'ancien chemin amorti du round 1-2 nourrissait la
        // pression mémoire qu'il essayait de fuir).
        map.remove()
        if (mapRef.current === map) mapRef.current = null
        switchToRaster()
      }, RESTORE_GRACE_MS)
    }

    // Point d'entrée commun du handler webglcontextlost et du fallback
    // visibilitychange (spec §4).
    function handleContextLoss(map: maplibregl.Map) {
      if (cancelled || graceTimeout) return
      lossCount += 1
      if (lossCount >= 2) {
        // 2e perte de la même session : bascule immédiate, sans nouvelle grâce.
        map.remove()
        if (mapRef.current === map) mapRef.current = null
        switchToRaster()
        return
      }
      warmRasterFallback(map)
      if (document.visibilityState !== 'visible') {
        pendingHiddenLoss = true
        return
      }
      startGrace(map)
    }

    async function init() {
      try {
        // Deux familles d'échec, deux réponses (spec carte hybride §4) : un fetch de
        // style qui échoue est un souci réseau — il garde le chemin de retries bornés
        // et ne doit JAMAIS condamner l'appareil au raster ; une construction de Map
        // qui échoue est un contexte WebGL refusé — bascule raster immédiate.
        let style
        try {
          // Round 3: reuse the cached, already-fetched-and-recolored style across
          // rebuilds/retries instead of refetching + re-parsing + re-recoloring the
          // style's layers every time (see getRecoloredStyle's own comment).
          style = await getRecoloredStyle(theme, getMapStyleUrl(theme))
        } catch {
          if (!cancelled) {
            setMapError(true)
            failureCount += 1
            // Fix round 1 (task 17b) + fast-follow : retry borné, compté dans le cap
            // partagé — voir les commentaires de MAX_REBUILDS_PER_MOUNT.
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
        // Retour QA v1.1 : l'attribution compacte (<details>) s'ouvre d'elle-même à
        // l'init et chevauche le crédit bas-gauche sur mobile — refermée par défaut,
        // le bouton ⓘ reste accessible pour la consulter.
        const attrib = containerRef.current.querySelector('details.maplibregl-ctrl-attrib')
        if (attrib instanceof HTMLDetailsElement) {
          attrib.open = false
          attrib.classList.remove('maplibregl-compact-show')
        }
        failureCount = 0
        setMapError(false)

        // top-left: bottom-right sits under the bottom sheet on mobile once a shop is
        // selected, and top-right is already the FR/EN toggle — top-left stays reachable
        // in both states.
        map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-left')

        for (const shop of shops) {
          const holder = document.createElement('div')
          holder.innerHTML = cookieMarkerHtml(shop.name, shop.slug)
          const el = holder.firstElementChild as HTMLElement
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            setSelected(shop)
          })
          new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([shop.lng, shop.lat]).addTo(map)
        }
        map.on('click', () => setSelected(null))
        // Reflète la sélection courante sur les marqueurs fraîchement créés
        // (cas initialSlug et rebuild après retry) — même chemin que l'effet [selected].
        if (containerRef.current) {
          applyMarkerSelection(containerRef.current, selectedRef.current?.slug ?? null)
        }

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
          pendingHiddenLoss = false
        })
      } catch {
        // Création du contexte WebGL refusée (GPUInitializationError & co) : c'est le
        // cas « appareil au WebGL cassé » de l'incident iPhone — bascule raster
        // immédiate, aucun écran d'erreur, préférence mémorisée (spec §4).
        if (!cancelled) switchToRaster()
      }
    }
    init()

    // Defense in depth: some mobile browsers suppress `webglcontextlost` while the tab is
    // hidden and only leave the dead canvas discoverable once the tab is foregrounded again.
    // Re-check on visibilitychange and rebuild if the canvas reports its context lost.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      const map = mapRef.current
      if (!map) return
      // Une perte signalée pendant que l'onglet était caché démarre sa grâce
      // seulement maintenant (spec §4 : l'horloge ne court qu'au premier plan).
      if (pendingHiddenLoss) {
        pendingHiddenLoss = false
        if (!graceTimeout) startGrace(map)
        return
      }
      const canvas = map.getCanvas()
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (gl?.isContextLost()) {
        // Certains navigateurs mobiles suppriment webglcontextlost onglet caché et ne
        // laissent le canvas mort découvrable qu'au retour — même point d'entrée que
        // l'événement.
        handleContextLoss(map)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      if (graceTimeout) clearTimeout(graceTimeout)
      if (failureRetryTimeout) clearTimeout(failureRetryTimeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSession, renderer])

  // Spec v1.2 §1 : chemin caméra + état visuel UNIFIÉ — tap marqueur, tap dans le
  // panneau liste et fermeture de fiche passent tous par l'état `selected`.
  useEffect(() => {
    if (containerRef.current) applyMarkerSelection(containerRef.current, selected?.slug ?? null)
    const map = mapRef.current
    if (!selected || !map) return
    map.easeTo({
      center: [selected.lng, selected.lat],
      zoom: shopFocusZoom(map.getZoom()),
      offset: [0, SHEET_CAMERA_OFFSET_Y],
      duration: 600,
    })
  }, [selected])

  // Le toggle thème recharge le style sans démonter la carte : la caméra, les
  // marqueurs DOM et l'état de sélection survivent au changement.
  useEffect(() => {
    return onThemeChange((theme) => {
      const map = mapRef.current
      if (!map) return
      getRecoloredStyle(theme, getMapStyleUrl(theme))
        .then((style) => {
          if (mapRef.current === map) map.setStyle(style)
        })
        .catch(() => {
          /* le style courant reste affiché ; le prochain toggle retentera */
        })
    })
  }, [])

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {renderer === 'raster' ? (
        <RasterMap shops={shops} selected={selected} onSelect={setSelected} onRetryWebgl={retryWebgl} />
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
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
      <MapChrome
        onLogoClick={() => {
          setIntroOrigin('logo')
          setIntroOpen(true)
        }}
      />
      {/* Onglet accroché au bord gauche, à mi-hauteur : le panneau liste sort de ce
          côté — le bouton vit là où l'UI s'ouvre (retour QA v1.2 round 1). */}
      <button
        onClick={() => setListOpen(true)}
        aria-label={t('listOpen')}
        className="absolute left-0 top-1/2 z-10 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-body)] shadow-[var(--shadow-chip)] transition-colors hover:bg-[color:var(--surface-2)]"
      >
        <IconList size={16} />
      </button>
      <ThemeToggle className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 flex h-[34px] w-[46px] items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-body)] shadow-[var(--shadow-chip)] transition-colors hover:bg-[color:var(--surface-2)]" />
      <ShopListPanel
        shops={shops}
        open={listOpen}
        onClose={() => setListOpen(false)}
        onPick={(shop) => {
          // Même chemin caméra que le tap marqueur (spec §1) via l'effet [selected].
          setListOpen(false)
          setSelected(shop)
        }}
      />
      <IntroPopup open={introOpen} origin={introOrigin} onClose={() => setIntroOpen(false)} />
      {selected && <ShopSheet shop={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
