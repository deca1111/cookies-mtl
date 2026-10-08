// Séquence de la scène (spec §10, revue après l'UAT). `contests.reveal_step` est
// un index dans ce tableau ; le recalculer à partir des résultats (figés hors
// phase de vote) rend la reprise après rechargement exacte.
//
// Déroulé : titre → rangs du bas → 3e → duel final → écran final.
// - Rangs du bas (au-delà du podium) : groupés en tableaux qui se remplissent en
//   cascade, une étape par tableau ; s'il n'y en a que quelques-uns, une slide
//   par rang (numéro et note, puis auteurs).
// - Duel : montrer le 1er après tous les autres le laissait deviner par
//   élimination. Les finalistes (1er et 2e) arrivent donc ensemble, puis une
//   seule étape révèle qui gagne, puis leurs auteurs.
import type { PlateResult } from './contest-scoring'

export type DuelStage = 'intro' | 'result' | 'authors'

export type RevealStep =
  | { kind: 'title' }
  | { kind: 'board'; plateIds: number[] }
  | { kind: 'plate'; plateIds: number[]; position: number; showAuthors: boolean; podium: boolean }
  | { kind: 'duel'; plateIds: number[]; stage: DuelStage }
  | { kind: 'final' }

// Au-delà de 3 assiettes sous le podium, une slide par rang devient longue.
const SOLO_MAX = 3
// Lignes par tableau : lisibles depuis le fond d'une salle sur une TV.
const BOARD_MAX = 8

export function buildRevealSteps(results: PlateResult[]): RevealStep[] {
  const ranked = results.filter((r): r is PlateResult & { position: number } => r.position !== null)
  const at = (p: number) => ranked.filter((r) => r.position === p).map((r) => r.plateId)
  const twoSteps = (position: number, podium: boolean): RevealStep[] => {
    const plateIds = at(position)
    return [
      { kind: 'plate', plateIds, position, showAuthors: false, podium },
      { kind: 'plate', plateIds, position, showAuthors: true, podium },
    ]
  }

  const steps: RevealStep[] = [{ kind: 'title' }]

  // Du moins bon au meilleur. `results` arrive trié du meilleur au moins bon.
  const lower = ranked.filter((r) => r.position > 3).reverse()
  if (lower.length > SOLO_MAX) {
    const boards = Math.ceil(lower.length / BOARD_MAX)
    const size = Math.ceil(lower.length / boards)
    for (let i = 0; i < lower.length; i += size) {
      steps.push({ kind: 'board', plateIds: lower.slice(i, i + size).map((r) => r.plateId) })
    }
  } else {
    const positions = [...new Set(lower.map((r) => r.position))]
    for (const p of positions) steps.push(...twoSteps(p, false))
  }

  if (at(3).length > 0) steps.push(...twoSteps(3, true))

  // Finalistes : le 1er et le 2e (ou plusieurs 1ers ex æquo). Ordre neutre (par
  // id) pour ne rien trahir avant l'étape du verdict.
  const finalists = ranked.filter((r) => r.position <= 2).map((r) => r.plateId)
  if (finalists.length >= 2) {
    const plateIds = [...finalists].sort((a, b) => a - b)
    for (const stage of ['intro', 'result', 'authors'] as const) steps.push({ kind: 'duel', plateIds, stage })
  } else if (finalists.length === 1) {
    steps.push(...twoSteps(1, true))
  }

  steps.push({ kind: 'final' })
  return steps
}

export function isFinalStep(step: number, steps: RevealStep[]): boolean {
  return step >= steps.length - 1
}
