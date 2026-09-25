// Calcul du concours (spec 2026-09-25 §2). Pur : aucune dépendance à la base, pour
// que chaque règle — normalisation, bulletins partiels, ex æquo — soit testable seule.

export type PlateRef = { id: number; number: number }
// Bulletin ordonné, meilleure assiette en premier.
export type Ballot = { guestId: number; plateIds: number[] }

export type PlateResult = {
  plateId: number
  // Rang de compétition (1, 2, 2, 4). null = assiette qui n'a reçu aucune voix.
  position: number | null
  // Moyenne des scores normalisés reçus, dans [0, 1]. L'affichage multiplie par 100.
  score: number | null
  avgRank: number | null
  votes: number
  bestRank: number | null
  worstRank: number | null
  firsts: number
}

// Les scores sont des fractions : deux moyennes « égales » peuvent différer au
// dernier bit selon l'ordre des additions. On compare avec une tolérance.
const EPS = 1e-9

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function computeResults(plates: PlateRef[], ballots: Ballot[]): PlateResult[] {
  const acc = new Map(plates.map((p) => [p.id, { scores: [] as number[], ranks: [] as number[] }]))
  for (const b of ballots) {
    // Une assiette supprimée entre-temps disparaît du bulletin : le rang des
    // suivantes remonte d'autant, ce qui revient au recompactage de la spec.
    const ids = b.plateIds.filter((id) => acc.has(id))
    const n = ids.length
    // Un bulletin d'une seule assiette ne compare rien : il ne compte pas.
    if (n < 2) continue
    ids.forEach((id, i) => {
      const a = acc.get(id)!
      a.scores.push((n - 1 - i) / (n - 1))
      a.ranks.push(i + 1)
    })
  }

  const numberOf = new Map(plates.map((p) => [p.id, p.number]))
  const rows: PlateResult[] = plates.map((p) => {
    const { scores, ranks } = acc.get(p.id)!
    const votes = scores.length
    return {
      plateId: p.id,
      position: null,
      score: votes ? mean(scores) : null,
      avgRank: votes ? mean(ranks) : null,
      votes,
      bestRank: votes ? Math.min(...ranks) : null,
      worstRank: votes ? Math.max(...ranks) : null,
      firsts: ranks.filter((r) => r === 1).length,
    }
  })

  rows.sort((x, y) => {
    if (x.score === null || y.score === null) {
      if (x.score !== y.score) return x.score === null ? 1 : -1
    } else {
      if (Math.abs(x.score - y.score) > EPS) return y.score - x.score
      if (Math.abs(x.avgRank! - y.avgRank!) > EPS) return x.avgRank! - y.avgRank!
    }
    return numberOf.get(x.plateId)! - numberOf.get(y.plateId)!
  })

  rows.forEach((r, i) => {
    if (r.score === null) return
    const prev = rows[i - 1]
    r.position = prev && prev.score !== null && Math.abs(prev.score - r.score) <= EPS ? prev.position : i + 1
  })
  return rows
}

// Accord d'un invité avec le groupe (spec §2) : Spearman entre son bulletin et
// l'ordre final restreint aux assiettes qu'il a classées, ramené en pourcentage.
export function agreement(ballot: number[], finalOrder: number[]): number | null {
  const pos = new Map(finalOrder.map((id, i) => [id, i]))
  const mine = ballot.filter((id) => pos.has(id))
  const n = mine.length
  if (n < 3) return null
  const consensus = [...mine].sort((a, b) => pos.get(a)! - pos.get(b)!)
  const consensusRank = new Map(consensus.map((id, i) => [id, i]))
  const d2 = mine.reduce((sum, id, i) => sum + (i - consensusRank.get(id)!) ** 2, 0)
  const rho = 1 - (6 * d2) / (n * (n * n - 1))
  return Math.round(((rho + 1) / 2) * 100)
}
