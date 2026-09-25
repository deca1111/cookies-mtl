// Ce que chaque écran a le droit de voir, construit à partir des données brutes.
// Pur, donc testable : c'est ICI que se joue la règle « aucun auteur ni score côté
// invité avant l'écran final de la scène » (spec §7).
import { agreement, computeResults, type Ballot } from './contest-scoring'
import type { Phase } from './contest-rules'
import { buildRevealSteps, isFinalStep, type RevealStep } from './contest-reveal'

export type Contest = { id: number; name: string; secret: string; phase: Phase; revealStep: number }
export type GuestRow = { id: number; name: string; claimed: boolean }
export type PlateRow = { id: number; number: number; label: string | null; authorIds: number[] }
export type ContestData = { guests: GuestRow[]; plates: PlateRow[]; ballots: Ballot[] }

export type ResultRow = {
  plateId: number
  number: number
  label: string | null
  authors: string[]
  position: number | null
  score: number | null
  avgRank: number | null
  votes: number
  bestRank: number | null
  worstRank: number | null
  firsts: number
}

export type GuestView = {
  name: string
  phase: Phase
  final: boolean
  me: { id: number; name: string } | null
  guests: { id: number; name: string; taken: boolean }[]
  plates: { id: number; number: number; label: string | null }[]
  myBallot: number[]
  results: { rows: ResultRow[]; agreement: number | null; myPlates: ResultRow[] } | null
}

export type AdminGuest = { id: number; name: string; claimed: boolean; ranked: number; rankable: number }

export type AdminView = {
  contest: Contest
  guests: AdminGuest[]
  plates: PlateRow[]
  rows: ResultRow[]
  steps: RevealStep[]
  complete: number
}

export function resultRows(data: ContestData): ResultRow[] {
  const nameOf = new Map(data.guests.map((g) => [g.id, g.name]))
  const plateOf = new Map(data.plates.map((p) => [p.id, p]))
  return computeResults(data.plates, data.ballots).map((r) => {
    const p = plateOf.get(r.plateId)!
    return {
      ...r,
      number: p.number,
      label: p.label,
      authors: p.authorIds.map((id) => nameOf.get(id)).filter((n): n is string => !!n).sort(),
      score: r.score === null ? null : Math.round(r.score * 100),
    }
  })
}

// Assiettes qu'un invité a le droit de classer : toutes sauf les siennes.
function rankableFor(data: ContestData, guestId: number) {
  return data.plates.filter((p) => !p.authorIds.includes(guestId))
}

function ballotOf(data: ContestData, guestId: number): number[] {
  const allowed = new Set(rankableFor(data, guestId).map((p) => p.id))
  return (data.ballots.find((b) => b.guestId === guestId)?.plateIds ?? []).filter((id) => allowed.has(id))
}

export function buildGuestView(contest: Contest, data: ContestData, meId: number | null): GuestView {
  const me = data.guests.find((g) => g.id === meId) ?? null
  const rows = resultRows(data)
  const final = contest.phase === 'reveal' && isFinalStep(contest.revealStep, buildRevealSteps(rows))
  const myBallot = me ? ballotOf(data, me.id) : []
  const finalOrder = rows.filter((r) => r.position !== null).map((r) => r.plateId)
  return {
    name: contest.name,
    phase: contest.phase,
    final,
    me: me && { id: me.id, name: me.name },
    guests: data.guests.map((g) => ({ id: g.id, name: g.name, taken: g.claimed && g.id !== me?.id })),
    plates: (me ? rankableFor(data, me.id) : data.plates).map(({ id, number, label }) => ({ id, number, label })),
    myBallot,
    results: final
      ? {
          rows,
          agreement: agreement(myBallot, finalOrder),
          myPlates: me ? rows.filter((r) => data.plates.find((p) => p.id === r.plateId)?.authorIds.includes(me.id)) : [],
        }
      : null,
  }
}

export function buildAdminView(contest: Contest, data: ContestData): AdminView {
  const rows = resultRows(data)
  const guests = data.guests.map((g) => ({
    ...g,
    ranked: ballotOf(data, g.id).length,
    rankable: rankableFor(data, g.id).length,
  }))
  return {
    contest,
    guests,
    plates: data.plates,
    rows,
    steps: buildRevealSteps(rows),
    complete: guests.filter((g) => g.rankable > 0 && g.ranked === g.rankable).length,
  }
}
