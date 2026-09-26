import type { ResultRow } from './contest-state'

// Pyramide de l'écran final (spec PR 2 §6-7). Les positions suivent le rang de
// compétition (1, 1, 3) : deux 1ers ex æquo laissent la marche 2 vide.
export function podium(rows: ResultRow[]) {
  const at = (p: number) => rows.filter((r) => r.position === p)
  return {
    first: at(1),
    second: at(2),
    third: at(3),
    rest: rows.filter((r) => r.position === null || r.position > 3),
  }
}
