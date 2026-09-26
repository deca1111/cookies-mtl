'use client'

import { useEffect } from 'react'
import { resolveTheme } from '@/lib/theme'

// La partie concours est toujours en sombre (voir isContestPath dans lib/theme).
// Le script inline couvre le premier chargement ; ce composant couvre la
// navigation côté client, dans les deux sens. On ne passe pas par applyTheme :
// le choix mémorisé pour la carte reste intact et revient en sortant.
export function ForceDarkTheme() {
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    return () => {
      document.documentElement.dataset.theme = resolveTheme()
    }
  }, [])
  return null
}
