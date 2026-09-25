'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Synchronisation du concours (spec §7) : on relit l'état entier toutes les
// 2,5 s. Onglet caché → pause (batterie) ; retour au premier plan → relecture
// immédiate, pour qu'un téléphone sorti de veille rattrape la phase en cours.
export function usePolling<T>(url: string, initial: T, intervalMs = 2500) {
  const [data, setData] = useState<T>(initial)
  const [offline, setOffline] = useState(false)
  const [gone, setGone] = useState(false)
  // 401 (session admin expirée) ou 500 : distinct de `offline` (panne réseau, pas
  // de réponse) et de `gone` (404, définitif). Effacé par la prochaine réponse OK.
  const [error, setError] = useState(false)
  const inFlight = useRef(false)

  // `force` contourne le verrou anti-chevauchement (ex. relire tout de suite après
  // avoir réclamé un nom) : deux requêtes peuvent alors cohabiter en vol. Rien ne
  // garantit leur ordre de RÉSOLUTION — la plus lente peut retomber après la plus
  // rapide et écraser un état plus frais avec une valeur périmée (ex. juste après
  // avoir réclamé un nom, un sondage périodique parti avant remettrait `me` à
  // null). `seq` numérote chaque requête à son DÉPART, `appliedSeq` retient le
  // numéro de la dernière appliquée : une réponse dont le numéro est inférieur ou
  // égal arrive après une plus récente déjà affichée et est ignorée.
  const seq = useRef(0)
  const appliedSeq = useRef(0)
  // Dernière donnée effectivement appliquée, par n'importe quelle requête : ce que
  // `refresh` renvoie à son appelant même quand CETTE requête-ci était périmée —
  // utile à qui a besoin de la valeur la plus fraîche connue juste après l'avoir
  // attendue (le bulletin invité relance un envoi avec les assiettes tout juste
  // relues, cf. ContestGuestApp).
  const latest = useRef(initial)

  const refresh = useCallback(async (force = false): Promise<T | undefined> => {
    if (inFlight.current && !force) return undefined
    inFlight.current = true
    const mySeq = ++seq.current
    try {
      const res = await fetch(url, { cache: 'no-store' })
      setOffline(false)
      if (res.status === 404) {
        if (mySeq > appliedSeq.current) {
          appliedSeq.current = mySeq
          setGone(true)
        }
        return undefined
      }
      if (res.ok) {
        const json = (await res.json()) as T
        // Le `await` ci-dessus laisse le temps à une requête plus récente de
        // s'appliquer avant que celle-ci ne reprenne la main : on revérifie donc
        // l'ordre juste avant d'écrire l'état, pas seulement à la réception HTTP.
        if (mySeq > appliedSeq.current) {
          appliedSeq.current = mySeq
          latest.current = json
          setData(json)
          setError(false)
        }
        return latest.current
      }
      setError(true)
      return undefined
    } catch {
      setOffline(true)
      return undefined
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

  return { data, refresh, offline, gone, error }
}
