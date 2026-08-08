import { expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

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
