import { expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'

// Task 17b bug 1 (public map death on mobile): mobile browsers can lose the map's WebGL
// context (backgrounded tab reclaimed by the OS, or the mobile context cap). MapLibre
// surfaces that loss as a `webglcontextlost` map event; CookieMap should react by tearing
// the dead map down and rebuilding it. This mock captures the event handlers registered
// via `map.on(...)` so the test can dispatch them directly, the same way the existing
// admin-map-stability.test.tsx mocks maplibre-gl to unit-test effect behaviour without a
// real WebGL context.
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

import { CookieMap, __clearStyleCacheForTests } from '../CookieMap'

// Round 3 (iPhone incident, footprint reduction continued — see
// .superpowers/sdd/2026-08-07-cookies-mtl/incident-iphone-evidence.md, "Round 3"): CookieMap
// now caches the fetched+recolored style at module scope, keyed by (theme, url), so rebuilds
// and retries within (and across) a mount reuse it instead of refetching. That cache is
// intentionally NOT reset per mount in production — but this test file mounts <CookieMap>
// many times, each expecting its own fresh fetch-mock-driven initial load, so it must be
// cleared between tests via CookieMap's test-only escape hatch.
beforeEach(() => {
  // mockReset (not just mockClear) so a mockImplementation/mockImplementationOnce set by one
  // test (several below make the Map constructor throw, to simulate a failed rebuild — see
  // the Round 3 note further down) can never leak into the next test.
  mapConstructor.mockReset()
  removeSpy.mockClear()
  handlers = {}
  __clearStyleCacheForTests()
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ layers: [] }),
  })) as unknown as typeof fetch
})

afterEach(() => {
  // This file renders <CookieMap> many times; without an explicit unmount between them, an
  // earlier test's un-torn-down effect (pending timers, visibilitychange listener) could
  // bleed into a later test — cleanup() runs each effect's own cleanup function synchronously.
  cleanup()
  vi.restoreAllMocks()
})

// Round 3: MapLibre already has a built-in, zero-network webglcontextlost/webglcontextrestored
// recovery path (it saves the in-memory style before tearing the WebGL context down, then
// restores from that saved copy — no refetch). CookieMap used to call scheduleRebuild
// synchronously on every webglcontextlost, discarding that cheap built-in recovery before the
// browser got a chance to use it. It now gives MapLibre's own recovery a bounded
// RESTORE_GRACE_MS (6000ms) window first, via handleContextLoss, and only falls back to the
// existing damped/capped rebuild if webglcontextrestored doesn't fire in time.

test('rebuilds the map when maplibre reports webglcontextlost and it is not restored in time', async () => {
  render(<CookieMap shops={[]} />)

  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })

    // MapLibre gets first crack at recovering itself for free — the dead map is NOT torn down
    // immediately. It's given the grace window to fire webglcontextrestored on its own before
    // the fallback rebuild kicks in.
    expect(removeSpy).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000) // grace window elapses without a restore
    })
    // Only now does the fallback path tear the dead map down and start the damping cooldown.
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(mapConstructor).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('restores within the grace window — no teardown, no new map is constructed', async () => {
  render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))
  await waitFor(() => expect(handlers.webglcontextrestored).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })

    // Partway through the grace window, MapLibre's own recovery fires webglcontextrestored —
    // its built-in, zero-network in-memory restore already brought the map back.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    act(() => {
      handlers.webglcontextrestored()
    })

    // Waiting well past both the grace window and the damping cooldown proves no fallback
    // rebuild was ever scheduled — MapLibre's own recovery was trusted and nothing else
    // happened: no teardown, no new Map construction.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(removeSpy).not.toHaveBeenCalled()
    expect(mapConstructor).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

test('does not rebuild until both the grace window and the damping cooldown elapse', async () => {
  render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })

    // Just short of the grace window: MapLibre could still recover on its own — no teardown.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5999)
    })
    expect(removeSpy).not.toHaveBeenCalled()
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    // Crossing the 6000ms grace boundary without a restore: the fallback tears the dead map
    // down and starts the separate damping cooldown — still no new map yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    // Just short of the cooldown: still no rebuild.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    // Crossing the 2000ms cooldown boundary triggers exactly one rebuild.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(mapConstructor).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

// Round 3: fetching + parsing + recoloring the ~123-layer style is real work that used to
// re-run on every context-loss-triggered rebuild. It's now cached per (theme, url) at module
// scope, so a rebuild reuses the already-recolored style object instead of refetching.

test('caches the fetched+recolored style — a loss-triggered rebuild reuses it instead of refetching', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ layers: [] }) }))
  global.fetch = fetchMock as unknown as typeof fetch

  render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))
  expect(fetchMock).toHaveBeenCalledTimes(1)

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000) // grace window, no restore
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000) // damping cooldown -> init() re-runs
    })
    expect(mapConstructor).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }

  // Two inits (the initial mount + the loss-triggered rebuild) produced two Map instances, but
  // the style was fetched only once — the rebuild reused the cached, already-recolored style
  // object instead of re-fetching + re-parsing + re-recoloring all 123 layers.
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

// Fix round 1 (task 17b review, Important finding): the original code only reset the
// in-flight `rebuilding` guard on the SUCCESS path. If a rebuild's own retry also failed,
// `rebuilding` stayed `true` forever — no live map left to ever fire another
// `webglcontextlost`, and `onVisibilityChange` bailed on the flag on every future check, so
// the user was stuck on the mapError screen until a full reload. These two tests exercise
// the bounded-retry fix: `rebuilding` must not latch (a scheduled retry gets to attempt
// another init), and the retry count must be capped (a circuit breaker, not an infinite loop).
//
// Round 3 note: with the style cache above, a rebuild's init() no longer refetches, so a
// fetch-mock failure can no longer simulate "the rebuild's init() fails" the way these tests
// used to. They now fail Map construction itself instead (e.g. WebGL context creation failing
// right after a loss, under the same memory pressure that caused the loss in the first place)
// — init()'s try/catch treats that identically to a fetch failure, so the same
// rebuilding-doesn't-latch / retry-recovers assertions still hold.

test('a failed rebuild does not latch `rebuilding` — the scheduled retry recovers the map', async () => {
  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  mapConstructor.mockImplementationOnce(() => {
    throw new Error('context creation failed')
  })

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    expect(removeSpy).not.toHaveBeenCalled()

    // Cross the grace window: MapLibre's own webglcontextrestored never fired.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(removeSpy).toHaveBeenCalledTimes(1)

    // Cross the cooldown: the rebuild's init() runs and its Map construction throws.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(mapConstructor).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()

    // Advance past the bounded 3000ms failure-retry. Before the "Fix round 1" latch fix,
    // `rebuilding` stuck `true` meant nothing in the component would ever call init() again
    // — this retry is the only path back to a live map after a failed rebuild.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mapConstructor).toHaveBeenCalledTimes(3)
    expect(container.querySelector('.absolute.inset-0')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('gives up after 3 consecutive failed attempts — no 4th retry is scheduled', async () => {
  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  // From here on, every init attempt (the rebuild and all of its retries) fails.
  mapConstructor.mockImplementation(() => {
    throw new Error('context creation failed')
  })

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    // Only the grace-window timer is pending so far — nothing has been torn down yet.
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    // Grace elapsed without a restore: the dead map is torn down and the damping cooldown
    // timer is now the only one pending.
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    // Failure #1 (the rebuild's own init(), once the cooldown elapsed): one retry scheduled.
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // Failure #2 (1st retry): a 2nd retry scheduled.
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // Failure #3 (2nd retry): circuit breaker trips — no 4th attempt scheduled.
    expect(vi.getTimerCount()).toBe(0)

    // Give it one more window to prove nothing fires on its own.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(vi.getTimerCount()).toBe(0)

    // 1 successful initial mount + 3 failed attempts (the rebuild + 2 retries), each of which
    // reaches (and throws inside) the Map constructor.
    expect(mapConstructor).toHaveBeenCalledTimes(4)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

// Round 2 — footprint reduction (iPhone incident, see
// .superpowers/sdd/2026-08-07-cookies-mtl/incident-iphone-evidence.md, "Round 2 — footprint
// reduction"): the damping/cap fix above stops the rebuild loop from running away, but the
// user's iPhone still lost the WebGL context repeatedly during active use — consistent with
// GPU memory pressure from rendering at devicePixelRatio 3 (a real iPhone value) exceeding iOS
// Safari's tolerance. Standard MapLibre mitigation: cap the render pixel ratio at 2. This test
// pins that the Map constructor never receives a pixelRatio above 2, even when
// window.devicePixelRatio reports 3.

test('caps the map pixelRatio at 2 and sets an explicit tile cache size, even when devicePixelRatio reports 3', async () => {
  const originalDpr = window.devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
  try {
    render(<CookieMap shops={[]} />)
    await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

    const options = mapConstructor.mock.calls[0][0] as { pixelRatio?: number; maxTileCacheSize?: number }
    expect(options.pixelRatio).toBe(2)
    // Round 3: unset maxTileCacheSize defaults to viewport-scaled dynamic sizing — the
    // documented iOS OOM crash mechanism in mapbox/mapbox-gl-js#4052. This only needs to catch
    // a regression back to "unset"; the exact chosen value and its rationale live next to
    // MAX_TILE_CACHE_SIZE in CookieMap.tsx.
    expect(options.maxTileCacheSize).toBeTypeOf('number')
    expect(options.maxTileCacheSize).toBeGreaterThan(0)
  } finally {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
  }
})

test('counts failure retries against the rebuild cap — cap is shared, not separate', async () => {
  // Fast-follow: ensure that failure-retry attempts consume from the per-mount rebuild budget,
  // so a flapping scenario (loss + failed init + retry + loss + ...) cannot exceed the cap
  // even when mixing loss-triggered rebuilds with failure-retry attempts.
  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  mapConstructor.mockImplementation(() => {
    throw new Error('context creation failed')
  })

  vi.useFakeTimers()
  try {
    // Fire a loss that will trigger a rebuild once the grace window elapses without a restore.
    act(() => {
      handlers.webglcontextlost()
    })
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000) // grace window, no restore
    })
    expect(removeSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000) // damping cooldown
    })
    // The rebuild's init() ran and failed — we're now at rebuildCount=1, failureCount=1. A
    // retry is scheduled (rebuildCount incremented to 2).
    expect(mapConstructor).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // 1st failure retry also failed. rebuildCount is now 2->3, failureCount is now 1->2.
    // Another retry is scheduled (rebuildCount incremented to 3).
    expect(mapConstructor).toHaveBeenCalledTimes(3)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // 2nd failure retry also failed. failureCount hit its limit (< 3 is false), so no more
    // retries scheduled.
    expect(mapConstructor).toHaveBeenCalledTimes(4)

    // Wait to prove no more timers are pending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    // Total Map constructions: 1 successful initial mount + 3 failed attempts (the rebuild +
    // its two retries), all of which reached (and threw inside) the Map constructor.
    // rebuildCount ends at 3 (1 for the rebuild + 2 for the retries) — well under the cap of
    // 5 — but failureCount's independent < 3 limit cut off the retries first.
    expect(mapConstructor).toHaveBeenCalledTimes(4)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('caps loss-triggered rebuilds at 5 per mount — the 6th loss shows the error state instead of rebuilding', async () => {
  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

  vi.useFakeTimers()
  try {
    // 5 loss->successful-rebuild cycles: each one clears the grace window and cooldown and
    // produces one more Map construction (2..6).
    for (let i = 0; i < 5; i++) {
      expect(handlers.webglcontextlost).toBeTypeOf('function')
      act(() => {
        handlers.webglcontextlost()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000) // grace window, no restore
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000) // damping cooldown
      })
      expect(mapConstructor).toHaveBeenCalledTimes(i + 2)
    }
    expect(container.querySelector('.absolute.inset-0')).toBeNull()

    // 6th loss: the per-mount cap is already reached, so no further rebuild is scheduled —
    // waiting out the grace window and cooldown proves nothing fires — and the error state
    // shows instead.
    act(() => {
      handlers.webglcontextlost()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(mapConstructor).toHaveBeenCalledTimes(6) // 1 initial + 5 rebuilds, never a 6th
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

// The retry button on the error screen (added alongside the pixelRatio cap): once the
// per-mount rebuild cap is exhausted and the error screen shows, the user has no way back to
// a live map short of a full page reload. Clicking « Réessayer » should reset the rebuild/
// failure counters (fresh closures, via a mapSession bump mirroring AdminApp's draftSession
// pattern) and re-run init(), constructing a brand new map.

test('clicking the retry button on the error screen resets the rebuild budget and builds a fresh map', async () => {
  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

  vi.useFakeTimers()
  try {
    // Exhaust the per-mount rebuild cap exactly like the capping test above: 5 successful
    // loss->rebuild cycles, then a 6th loss trips MAX_REBUILDS_PER_MOUNT and shows the error
    // screen instead of rebuilding.
    for (let i = 0; i < 5; i++) {
      expect(handlers.webglcontextlost).toBeTypeOf('function')
      act(() => {
        handlers.webglcontextlost()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
    }
    act(() => {
      handlers.webglcontextlost()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(mapConstructor).toHaveBeenCalledTimes(6)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }

  const retryButton = container.querySelector('.absolute.inset-0 button')
  expect(retryButton).not.toBeNull()

  fireEvent.click(retryButton as HTMLButtonElement)

  // The error screen clears immediately, and a fresh init() builds a 7th map — proving the
  // rebuild/failure counters were reset (a stale, exhausted counter would have shown the
  // error screen again instead of rebuilding).
  expect(container.querySelector('.absolute.inset-0')).toBeNull()
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(7))
})
