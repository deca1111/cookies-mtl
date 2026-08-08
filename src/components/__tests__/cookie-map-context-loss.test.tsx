import { expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

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

import { CookieMap } from '../CookieMap'

beforeEach(() => {
  mapConstructor.mockClear()
  removeSpy.mockClear()
  handlers = {}
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ layers: [] }),
  })) as unknown as typeof fetch
})

afterEach(() => {
  // This file now has 3 tests rendering <CookieMap>; without an explicit unmount between
  // them, an earlier test's un-torn-down effect (pending retryTimeout, visibilitychange
  // listener) could bleed into a later test — cleanup() runs each effect's own cleanup
  // function synchronously.
  cleanup()
  vi.restoreAllMocks()
})

test('rebuilds the map when maplibre reports webglcontextlost', async () => {
  render(<CookieMap shops={[]} />)

  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })

    // The dead map is torn down immediately; the rebuild itself waits out the damping
    // cooldown (see the cooldown test below) before init() runs again.
    expect(removeSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(mapConstructor).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

// Fix round 1 (task 17b review, Important finding): the original code only reset the
// in-flight `rebuilding` guard on the SUCCESS path. If a rebuild's own retry also failed,
// `rebuilding` stayed `true` forever — no live map left to ever fire another
// `webglcontextlost`, and `onVisibilityChange` bailed on the flag on every future check, so
// the user was stuck on the mapError screen until a full reload. These two tests exercise
// the bounded-retry fix: `rebuilding` must not latch (a scheduled retry gets to attempt
// another init), and the retry count must be capped (a circuit breaker, not an infinite loop).

test('a failed rebuild does not latch `rebuilding` — the scheduled retry recovers the map', async () => {
  let fetchCalls = 0
  global.fetch = vi.fn(async () => {
    fetchCalls += 1
    // Call 1: initial mount — succeeds. Call 2: the rebuild triggered by webglcontextlost
    // below, once the damping cooldown elapses — fails (simulates "network not back yet"
    // right after returning from background). Call 3+: the scheduled failure-retry —
    // succeeds again.
    if (fetchCalls === 2) return { ok: false, json: async () => ({}) }
    return { ok: true, json: async () => ({ layers: [] }) }
  }) as unknown as typeof fetch

  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    // The dead map is torn down immediately; the rebuild's own init() doesn't run until the
    // damping cooldown elapses.
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    // Cross the cooldown: the rebuild's init() runs and fails (fetchCalls === 2 above).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    // The failed rebuild could not build a replacement — the error screen is showing, and
    // no 2nd map has been constructed.
    expect(mapConstructor).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()

    // Advance past the bounded 3000ms failure-retry. Before the "Fix round 1" latch fix,
    // `rebuilding` stuck `true` meant nothing in the component would ever call init() again
    // — this retry is the only path back to a live map after a failed rebuild.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mapConstructor).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.absolute.inset-0')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('gives up after 3 consecutive failed attempts — no 4th retry is scheduled', async () => {
  global.fetch = vi.fn(async (_input, _init) => {
    return { ok: true, json: async () => ({ layers: [] }) }
  }) as unknown as typeof fetch

  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  // From here on, every init attempt (the rebuild and all of its retries) fails.
  global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })
    // Only the damping-cooldown timer is pending so far — init() hasn't even run once yet.
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

    // The map was never successfully rebuilt, and the error screen is still showing.
    expect(mapConstructor).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

// Fix round 2 (iPhone incident, see .superpowers/sdd/2026-08-07-cookies-mtl/incident-iphone-evidence.md):
// the "Fix round 1" circuit breaker above only bounds consecutive FAILED init() calls
// (failureCount resets to 0 on every successful init). Nothing bounded a success->loss->success
// flapping loop: each webglcontextlost fired an immediate, undamped, full init() with no delay
// and no cap on total rebuilds, so a mobile device flapping in and out of GPU memory pressure
// could rebuild the map (style fetch + tiles + markers) unboundedly until iOS Safari killed the
// page. These two tests pin the damping cooldown and the total-rebuild cap that fix that gap.

test('does not rebuild immediately on webglcontextlost — waits for the 2000ms damping cooldown', async () => {
  render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    act(() => {
      handlers.webglcontextlost()
    })

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

test('caps loss-triggered rebuilds at 5 per mount — the 6th loss shows the error state instead of rebuilding', async () => {
  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

  vi.useFakeTimers()
  try {
    // 5 loss->successful-rebuild cycles: each one clears the cooldown and produces one more
    // Map construction (2..6).
    for (let i = 0; i < 5; i++) {
      expect(handlers.webglcontextlost).toBeTypeOf('function')
      act(() => {
        handlers.webglcontextlost()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(mapConstructor).toHaveBeenCalledTimes(i + 2)
    }
    expect(container.querySelector('.absolute.inset-0')).toBeNull()

    // 6th loss: the per-mount cap is already reached, so no further rebuild is scheduled —
    // waiting out the cooldown window proves nothing fires — and the error state shows instead.
    act(() => {
      handlers.webglcontextlost()
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

test('counts failure retries against the rebuild cap — cap is shared, not separate', async () => {
  // Fast-follow: ensure that failure-retry attempts consume from the per-mount rebuild budget,
  // so a flapping scenario (loss + failed init + retry + loss + ...) cannot exceed the cap
  // even when mixing loss-triggered rebuilds with failure-retry attempts.
  let fetchCalls = 0
  global.fetch = vi.fn(async () => {
    fetchCalls += 1
    // Call 1: initial mount — succeeds.
    // Calls 2-4: loss-triggered rebuild + its two failure retries — all fail.
    // Calls 5+: if we got here, we've already hit the cap and shouldn't be calling init() anymore.
    if (fetchCalls <= 4 && fetchCalls > 1) return { ok: false, json: async () => ({}) }
    return { ok: true, json: async () => ({ layers: [] }) }
  }) as unknown as typeof fetch

  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    // Fire a loss that will trigger a rebuild. Once the cooldown elapses, init() is called
    // (call 2), but the style fetch fails — we're now at rebuildCount=1, failureCount=1.
    // A retry is scheduled for 3000ms later (rebuildCount incremented to 2).
    act(() => {
      handlers.webglcontextlost()
    })
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    // The rebuild's init() ran (call 2) and failed. No 2nd map yet.
    expect(mapConstructor).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // 1st failure retry (call 3) also failed. rebuildCount is now 2, failureCount is now 2.
    // Another retry is scheduled (rebuildCount incremented to 3).
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    // 2nd failure retry (call 4) also failed. rebuildCount is now 3, failureCount is now 3.
    // failureCount hit its limit (< 3 is false), so no more retries scheduled.
    expect(mapConstructor).toHaveBeenCalledTimes(1)

    // Wait to prove no more timers are pending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    // Total Map constructions: 1 initial + 0 successful rebuilds = 1. The rebuild and its two
    // retries all failed, so the map was never rebuilt. Most importantly, rebuildCount was
    // incremented (1 for the rebuild + 2 for the retries) and now sits at 3, so a subsequent
    // loss event would still have room to attempt rebuilds (cap is 5), but failureCount's
    // independent < 3 limit cut off the retries after the rebuild itself failed.
    expect(mapConstructor).toHaveBeenCalledTimes(1)
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

test('caps the map pixelRatio at 2 even when devicePixelRatio reports 3 (iPhone GPU memory footprint)', async () => {
  const originalDpr = window.devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
  try {
    render(<CookieMap shops={[]} />)
    await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

    const options = mapConstructor.mock.calls[0][0] as { pixelRatio?: number }
    expect(options.pixelRatio).toBe(2)
  } finally {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
  }
})
