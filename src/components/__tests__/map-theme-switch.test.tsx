// Vérifie le contrat de la Task 6 : un changement de thème appelle map.setStyle
// avec le style recoloré du nouveau thème, sans recréer la Map.
//
// Mock calqué sur cookie-map-raster-switch.test.tsx (la référence de ce repo pour
// mocker maplibre-gl) : classe minimale + spy `mapConstructor`, RasterMap stubbé
// pour éviter d'avoir à mocker Leaflet en plus.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const setStyle = vi.fn()
const mapConstructor = vi.fn()
vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapConstructor(options)
    }
    addControl() {}
    on() {}
    easeTo() {}
    remove() {}
    getCanvas() {
      return { getContext: () => ({ isContextLost: () => false }) } as unknown as HTMLCanvasElement
    }
    getCenter() {
      return { lng: -73.5674, lat: 45.5019 }
    }
    getZoom() {
      return 12
    }
    setStyle(style: unknown) {
      setStyle(style)
    }
  }
  class MockMarker {
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

// RasterMap est testé pour lui-même (raster-map.test.tsx) ; ici un stub suffit et
// évite de mocker Leaflet en plus de MapLibre (même pattern que
// cookie-map-raster-switch.test.tsx).
vi.mock('../RasterMap', () => ({
  RasterMap: () => null,
}))

import { CookieMap, __clearStyleCacheForTests } from '../CookieMap'
import { applyTheme } from '@/lib/theme'

beforeEach(() => {
  mapConstructor.mockReset()
  setStyle.mockReset()
  localStorage.clear()
  __clearStyleCacheForTests()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ layers: [] }) })) as unknown as typeof fetch
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

test('applyTheme fait suivre la carte MapLibre sans la recréer', async () => {
  document.documentElement.dataset.theme = 'light'
  render(<CookieMap shops={[]} />)
  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))

  await act(async () => {
    applyTheme('dark')
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(setStyle).toHaveBeenCalledTimes(1))
  expect(mapConstructor).toHaveBeenCalledTimes(1) // pas de rebuild
})
