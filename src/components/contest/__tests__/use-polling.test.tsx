import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { usePolling } from '../usePolling'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('rafraîchit périodiquement et signale le hors-ligne', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ n: 2 }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))
  expect(result.current.data).toEqual({ n: 1 })
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.data).toEqual({ n: 2 })
  fetchMock.mockRejectedValue(new TypeError('offline'))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.offline).toBe(true)
})

test('404 → gone', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.gone).toBe(true)
})
