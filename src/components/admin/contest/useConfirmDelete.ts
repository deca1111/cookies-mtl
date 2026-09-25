'use client'

import { useEffect, useRef, useState } from 'react'

// Confirmation légère avant une suppression irréversible (invité ou assiette —
// spec finding #4) : un « Suppr. » sans confirmation détruit des votes d'un clic
// malheureux. Premier clic : le bouton devient « Confirmer ? » pendant ARM_MS.
// Second clic dans ce délai : l'action part. Passé le délai (ou un autre bouton
// armé, ou le démontage du composant) l'armement retombe tout seul — jamais de
// minuteur orphelin qui appellerait `setState` après un unmount.
const ARM_MS = 3000

export function useConfirmDelete<Id>() {
  const [armed, setArmed] = useState<Id | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const disarm = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setArmed(null)
  }

  // `press` porte la logique des deux clics ET l'appel de l'action : le composant
  // n'a qu'à lui passer l'id concerné et ce qu'exécuter une fois confirmé.
  const press = (id: Id, onConfirm: () => void) => {
    if (armed === id) {
      disarm()
      onConfirm()
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setArmed(id)
    timer.current = setTimeout(disarm, ARM_MS)
  }

  return { armed, press }
}
