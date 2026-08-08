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

  act(() => {
    handlers.webglcontextlost()
  })

  await waitFor(() => expect(removeSpy).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(2))
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
    // below — fails (simulates "network not back yet" right after returning from
    // background). Call 3+: the scheduled retry — succeeds again.
    if (fetchCalls === 2) return { ok: false, json: async () => ({}) }
    return { ok: true, json: async () => ({ layers: [] }) }
  }) as unknown as typeof fetch

  const { container } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(handlers.webglcontextlost).toBeTypeOf('function'))

  vi.useFakeTimers()
  try {
    await act(async () => {
      handlers.webglcontextlost()
      // Flush the microtasks of the failing fetch (mocked, no real I/O delay) before
      // asserting on its outcome.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // The failed rebuild tore the old map down but could not build a replacement yet —
    // the error screen is showing, and no 2nd map has been constructed.
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(mapConstructor).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull()

    // Advance past the bounded 3000ms retry. Before the fix, `rebuilding` stuck `true`
    // meant nothing in the component would ever call init() again — this retry is the
    // only path back to a live map after a failed rebuild.
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
    await act(async () => {
      handlers.webglcontextlost()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    // Failure #1 (the rebuild itself): one retry scheduled.
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
