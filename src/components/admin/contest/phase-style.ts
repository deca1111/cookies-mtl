import type { Phase } from '@/lib/contest-rules'

// Code « feu » (spec PR 2 §2) : une couleur par phase, définie dans globals.css
// pour suivre le thème clair/sombre. On passe par une variable plutôt qu'une
// valeur en dur pour que le changement de thème s'applique sans rerendu.
export function phaseColorVar(phase: Phase): string {
  return `var(--phase-${phase})`
}
