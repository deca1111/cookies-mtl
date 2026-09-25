// Séquence de la scène (spec §10). `contests.reveal_step` est un index dans ce
// tableau ; le recalculer à partir des résultats (figés hors phase de vote) rend
// la reprise après rechargement exacte.
import type { PlateResult } from './contest-scoring'

export type RevealStep =
  | { kind: 'title' }
  | { kind: 'plate'; plateIds: number[]; position: number; showAuthors: boolean; podium: boolean }
  | { kind: 'final' }

export function buildRevealSteps(results: PlateResult[]): RevealStep[] {
  const groups = new Map<number, number[]>()
  for (const r of results) {
    if (r.position === null) continue
    groups.set(r.position, [...(groups.get(r.position) ?? []), r.plateId])
  }
  const steps: RevealStep[] = [{ kind: 'title' }]
  const positions = [...groups.keys()].sort((a, b) => b - a)
  for (const position of positions) {
    const plateIds = groups.get(position)!
    const podium = position <= 3
    steps.push({ kind: 'plate', plateIds, position, showAuthors: false, podium })
    steps.push({ kind: 'plate', plateIds, position, showAuthors: true, podium })
  }
  steps.push({ kind: 'final' })
  return steps
}

export function isFinalStep(step: number, steps: RevealStep[]): boolean {
  return step >= steps.length - 1
}
