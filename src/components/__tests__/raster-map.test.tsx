import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'

// Mock Leaflet : capture les appels sans DOM réel. RasterMap importe Leaflet
// dynamiquement (import('leaflet')), le mock couvre le module entier.
const tileLayerSpy = vi.fn()
const markerSpy = vi.fn()
const setViewSpy = vi.fn()
const removeSpy = vi.fn()
let markerClickHandlers: Array<() => void> = []

vi.mock('leaflet', () => {
  const map = vi.fn(() => ({
    setView: setViewSpy.mockReturnThis(),
    remove: removeSpy,
    setMaxBounds: vi.fn(),
    flyTo: vi.fn(),
    panTo: vi.fn(),
    getZoom: vi.fn(() => 12),
    addControl: vi.fn(),
    on: vi.fn(),
  }))
  const tileLayer = vi.fn((url: string, opts: unknown) => {
    tileLayerSpy(url, opts)
    return { addTo: vi.fn() }
  })
  const marker = vi.fn((latlng: unknown, opts: unknown) => {
    markerSpy(latlng, opts)
    const self = {
      addTo: vi.fn(() => self),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'click') markerClickHandlers.push(cb)
        return self
      }),
    }
    return self
  })
  const divIcon = vi.fn((opts: unknown) => opts)
  const Control = { extend: vi.fn(() => vi.fn()) }
  const mod = { map, tileLayer, marker, divIcon, Control }
  return { default: mod, ...mod }
})
vi.mock('leaflet/dist/leaflet.css', () => ({}))

import { RasterMap } from '../RasterMap'
import type { Shop } from '@/lib/shops'

const shop = { slug: 'a', name: 'Chez Test', lat: 45.5, lng: -73.56 } as Shop

beforeEach(() => {
  vi.clearAllMocks()
  markerClickHandlers = []
})
afterEach(() => cleanup())

test('monte Leaflet avec les tuiles du thème et un pin cliquable par boutique', async () => {
  const onSelect = vi.fn()
  render(<RasterMap shops={[shop]} selected={null} onSelect={onSelect} onRetryWebgl={() => {}} />)

  await waitFor(() => expect(tileLayerSpy).toHaveBeenCalledTimes(1))
  const [url, opts] = tileLayerSpy.mock.calls[0] as [string, { maxNativeZoom: number; bounds: unknown }]
  expect(url).toContain('/tiles/v1/light/{z}/{x}/{y}.webp')
  expect(opts.maxNativeZoom).toBe(16)
  // régression 404 hors pyramide : le calque DOIT borner ses requêtes à la bbox
  expect(opts.bounds).toEqual([
    [45.4, -73.75],
    [45.62, -73.45],
  ])

  await waitFor(() => expect(markerSpy).toHaveBeenCalledTimes(1))
  expect(markerClickHandlers).toHaveLength(1)
  act(() => markerClickHandlers[0]())
  expect(onSelect).toHaveBeenCalledWith(shop)
})

test('le lien « réessayer » déclenche onRetryWebgl', async () => {
  const onRetry = vi.fn()
  const { findByText } = render(
    <RasterMap shops={[]} selected={null} onSelect={() => {}} onRetryWebgl={onRetry} />
  )
  fireEvent.click(await findByText('Réessayer la carte détaillée'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('nettoie la carte au démontage', async () => {
  const { unmount } = render(
    <RasterMap shops={[]} selected={null} onSelect={() => {}} onRetryWebgl={() => {}} />
  )
  await waitFor(() => expect(tileLayerSpy).toHaveBeenCalled())
  unmount()
  expect(removeSpy).toHaveBeenCalledTimes(1)
})
