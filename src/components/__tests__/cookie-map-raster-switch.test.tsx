import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

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
// évite de mocker Leaflet en plus de MapLibre.
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
  localStorage.clear()
  clearRasterPreference()
  __clearStyleCacheForTests()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ layers: [] }) })) as unknown as typeof fetch
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('échec de création du contexte WebGL à l’init -> RasterMap immédiat + préférence écrite', async () => {
  mapConstructor.mockImplementation(() => {
    throw new Error('GPUInitializationError')
  })
  const { findByTestId, container } = render(<CookieMap shops={[]} />)

  await findByTestId('raster-map')
  // aucun écran d'erreur : la bascule remplace le message
  expect(container.querySelector('.absolute.inset-0')).toBeNull()
  expect(localStorage.getItem('cmtl_renderer')).toBe('raster')
})

test('préférence raster présente au mount -> MapLibre jamais instancié, pas de fetch de style', async () => {
  localStorage.setItem('cmtl_renderer', 'raster')
  const { findByTestId } = render(<CookieMap shops={[]} />)
  await findByTestId('raster-map')
  expect(mapConstructor).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
})

test('échec du fetch de style -> retries existants, PAS de bascule raster (souci réseau)', async () => {
  global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
  const { container, queryByTestId } = render(<CookieMap shops={[]} />)
  await waitFor(() => expect(container.querySelector('.absolute.inset-0')).not.toBeNull())
  expect(queryByTestId('raster-map')).toBeNull()
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})

test('« réessayer » depuis le raster efface la préférence et retente MapLibre', async () => {
  localStorage.setItem('cmtl_renderer', 'raster')
  const { findByTestId, findByText } = render(<CookieMap shops={[]} />)
  await findByTestId('raster-map')

  ;(await findByText('retry-webgl')).click()

  await waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1))
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})
