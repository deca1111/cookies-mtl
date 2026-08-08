import { expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'

// Spec carte hybride (docs/superpowers/specs/2026-08-08-carte-hybride-raster-design.md, §4) :
// une perte de contexte WebGL n'entraîne plus JAMAIS de rebuild MapLibre. La 1re perte laisse
// une grâce de 1500 ms au restore natif de MapLibre (in-memory, zéro réseau) en préchauffant
// le fallback en parallèle ; grâce écoulée ou 2e perte -> bascule vers RasterMap (Leaflet),
// mémorisée via localStorage['cmtl_renderer']. Le mock capture les handlers `map.on(...)`
// pour dispatcher les événements directement, comme admin-map-stability.test.tsx.
const mapConstructor = vi.fn()
const removeSpy = vi.fn()
let handlers: Record<string, () => void> = {}

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapConstructor(options)
      handlers = {}
    }
    addControl() {}
    on(event: string, cb: () => void) {
      handlers[event] = cb
    }
    easeTo() {}
    remove() {
      removeSpy()
    }
    getCanvas() {
      return { getContext: () => ({ isContextLost: () => false }) } as unknown as HTMLCanvasElement
    }
    getCenter() {
      return { lng: -73.5674, lat: 45.5019 }
    }
    getZoom() {
      return 12
    }
  }
  class MockMarker {
    constructor(options?: unknown) {}
    setLngLat() {
      return this
    }
    addTo() {
      return this
    }
  }
  class MockGeolocateControl {}
  return { Map: MockMap, Marker: MockMarker, GeolocateControl: MockGeolocateControl }
})

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// RasterMap est testé pour lui-même (raster-map.test.tsx) ; un stub évite de mocker
// Leaflet en plus de MapLibre. Le préchauffage (import('./RasterMap')) résout aussi
// vers ce stub — inoffensif.
vi.mock('../RasterMap', () => ({
  RasterMap: (props: { onRetryWebgl: () => void }) => (
    <div data-testid="raster-map">
      <button onClick={props.onRetryWebgl}>retry-webgl</button>
    </div>
  ),
}))

import { CookieMap, __clearStyleCacheForTests } from '../CookieMap'
import { clearRasterPreference } from '@/lib/map-renderer'

beforeEach(() => {
  mapConstructor.mockReset()
  removeSpy.mockClear()
  handlers = {}
  localStorage.clear()
  clearRasterPreference()
  __clearStyleCacheForTests()
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ layers: [] }),
  })) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('bascule en raster quand la grâce de 1500ms expire sans restore — jamais de rebuild', async () => {
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

test('restore dans la grâce : aucun teardown, aucune bascule, aucune nouvelle Map', async () => {
  const { queryByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))
  await waitFor(() => expect(handlers.webglcontextrestored).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    // le restore natif de MapLibre tire à mi-grâce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    act(() => {
      handlers.webglcontextrestored()
    })
    // bien au-delà de la grâce : rien d'autre ne se déclenche
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(removeSpy).not.toHaveBeenCalled()
    expect(mapConstructor).toHaveBeenCalledTimes(1)
    expect(queryByTestId('raster-map')).toBeNull()
    expect(localStorage.getItem('cmtl_renderer')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
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
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  }
})

test('préchauffe le fallback pendant la grâce : 9 tuiles du viewport demandées', async () => {
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

// Le cache de style module-scope (round 3) sert désormais le chemin retour du raster :
// « Réessayer la carte détaillée » relance MapLibre sans refetch du style.
test('retry-webgl après bascule réutilise le style en cache — un seul fetch de style', async () => {
  const { findByTestId, findByText } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  const styleFetches = () =>
    (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([u]) => typeof u === 'string' && !u.includes('/tiles/v1/')
    ).length
  expect(styleFetches()).toBe(1)

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
  } finally {
    vi.useRealTimers()
  }
  await findByTestId('raster-map')

  fireEvent.click(await findByText('retry-webgl'))
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(2))
  expect(styleFetches()).toBe(1) // le retour WebGL réutilise le style déjà recoloré
})

// Chemin réseau (fetch de style) : il garde les retries bornés et l'écran d'erreur —
// un souci réseau ne doit jamais condamner l'appareil au raster.
test('échec persistant du fetch de style : 3 tentatives, breaker, écran d’erreur, pas de raster', async () => {
  global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
  // Fake timers AVANT le render : le retry de l'échec initial doit être programmé
  // sous l'horloge fictive pour que les advances le déclenchent.
  vi.useFakeTimers()
  const { container, queryByTestId } = render(<CookieMap shops={[]} />)
  try {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0) // flush l'init initial -> échec 1, retry programmé
    })
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000) // retry 1
    })
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000) // retry 2 — puis breaker (failureCount = 3)
    })
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000) // plus rien ne se déclenche
    })
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3)
  } finally {
    vi.useRealTimers()
  }

  expect(container.querySelector('.absolute.inset-0')).not.toBeNull()
  expect(queryByTestId('raster-map')).toBeNull()
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})

test('le bouton Réessayer de l’écran d’erreur relance un init frais (réseau revenu)', async () => {
  // premier fetch KO, les suivants OK — simule un réseau qui revient
  global.fetch = vi
    .fn()
    .mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }))
    .mockImplementation(async () => ({ ok: true, json: async () => ({ layers: [] }) })) as unknown as typeof fetch

  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(container.querySelector('.absolute.inset-0')).not.toBeNull())
  expect(mapConstructor).not.toHaveBeenCalled()

  const retryButton = container.querySelector('.absolute.inset-0 button')
  expect(retryButton).not.toBeNull()
  fireEvent.click(retryButton as HTMLButtonElement)

  // l'écran s'efface immédiatement et l'init frais construit la carte
  expect(container.querySelector('.absolute.inset-0')).toBeNull()
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
})

// Round 2 — footprint reduction (inchangé) : pixelRatio plafonné à 2, tile cache borné.
test('caps the map pixelRatio at 2 and sets an explicit tile cache size, even when devicePixelRatio reports 3', async () => {
  const originalDpr = window.devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
  try {
    render(<CookieMap shops={[]} />)
    await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

    const options = mapConstructor.mock.calls[0][0] as { pixelRatio?: number; maxTileCacheSize?: number }
    expect(options.pixelRatio).toBe(2)
    expect(options.maxTileCacheSize).toBeTypeOf('number')
    expect(options.maxTileCacheSize).toBeGreaterThan(0)
  } finally {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
  }
})
