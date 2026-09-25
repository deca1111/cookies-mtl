'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Synchronisation du concours (spec §7) : on relit l'état entier toutes les
// 2,5 s. Onglet caché → pause (batterie) ; retour au premier plan → relecture
// immédiate, pour qu'un téléphone sorti de veille rattrape la phase en cours.
export function usePolling<T>(url: string, initial: T, intervalMs = 2500) {
  const [data, setData] = useState<T>(initial)
  const [offline, setOffline] = useState(false)
  const [gone, setGone] = useState(false)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch(url, { cache: 'no-store' })
      setOffline(false)
      if (res.status === 404) setGone(true)
      else if (res.ok) setData((await res.json()) as T)
    } catch {
      setOffline(true)
    } finally {
      inFlight.current = false
    }
  }, [url])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, intervalMs])

  return { data, refresh, offline, gone }
}
