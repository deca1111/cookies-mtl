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

test('refresh(true) contourne le verrou même si un sondage est déjà en vol', async () => {
  // Le premier appel ne se résout jamais : il simule un sondage périodique encore
  // en cours quand on force une relecture juste après une action (ex. réclamer un nom).
  const pending = new Promise<Response>(() => {})
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(pending)
    .mockResolvedValueOnce(new Response(JSON.stringify({ n: 3 }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))

  act(() => {
    void result.current.refresh()
  })
  await act(async () => {
    await result.current.refresh(true)
  })

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(result.current.data).toEqual({ n: 3 })
})

// Un sondage périodique parti AVANT une relecture forcée peut se résoudre APRÈS
// elle (chevauchement volontaire, cf. `force`). Sans ordonnancement, sa réponse —
// plus vieille — écraserait la donnée plus récente déjà affichée : exactement le
// bug qui remettait `me` à null juste après avoir réclamé un nom (finding #2).
test('une réponse plus ancienne résolue après une plus récente est ignorée', async () => {
  let resolveFirst: (r: Response) => void = () => {}
  const first = new Promise<Response>((r) => { resolveFirst = r })
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValueOnce(new Response(JSON.stringify({ n: 9 }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))

  // Sondage périodique parti en premier, toujours en vol...
  let pending: Promise<unknown> = Promise.resolve()
  act(() => {
    pending = result.current.refresh()
  })
  // ...une relecture forcée part ensuite et se résout la première.
  await act(async () => {
    await result.current.refresh(true)
  })
  expect(result.current.data).toEqual({ n: 9 })

  // Le premier sondage se résout enfin, avec une donnée plus vieille : ignorée.
  await act(async () => {
    resolveFirst(new Response(JSON.stringify({ n: 2 }), { status: 200 }))
    await pending
  })
  expect(result.current.data).toEqual({ n: 9 })
})

test('erreur serveur (401/500) : `error` s’allume, s’efface à la prochaine réponse OK', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ n: 5 }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))

  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.error).toBe(true)
  expect(result.current.data).toEqual({ n: 1 })

  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.error).toBe(false)
  expect(result.current.data).toEqual({ n: 5 })
})
