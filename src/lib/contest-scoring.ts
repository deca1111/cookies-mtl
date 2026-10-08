// Calcul du concours (spec 2026-09-25 §2, revu après l'UAT : « top K »). Pur :
// aucune dépendance à la base, pour que chaque règle soit testable seule.
//
// Chaque invité classe ses cookies ; seuls ses K premiers rapportent des points :
// K au 1er, K-1 au 2e… 1 au K-ième, rien au-delà. Chaque bulletin distribue donc
// les mêmes points, qu'il cite 5 cookies ou 20 — l'ancienne normalisation par
// bulletin donnait 0 au 5e d'un top 5, comme au pire d'un classement complet.
// K = null : mode « tout », K vaut le nombre de cookies du concours.

export type PlateRef = { id: number; number: number }
// Bulletin ordonné, meilleur cookie en premier.
export type Ballot = { guestId: number; plateIds: number[] }

export type PlateResult = {
  plateId: number
  // Rang de compétition (1, 1, 3). null = cookie cité dans aucun top : « au menu ».
  position: number | null
  // Total des points reçus ; null si aucun top ne le cite.
  score: number | null
  // Statistiques sur les seules citations dans un top K.
  avgRank: number | null
  votes: number
  bestRank: number | null
  worstRank: number | null
  firsts: number
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function computeResults(plates: PlateRef[], ballots: Ballot[], topK: number | null): PlateResult[] {
  const k = topK ?? plates.length
  const ranksOf = new Map(plates.map((p) => [p.id, [] as number[]]))
  for (const b of ballots) {
    // Un cookie supprimé entre-temps disparaît du bulletin : les suivants
    // remontent d'une place (recompactage de la spec).
    b.plateIds.filter((id) => ranksOf.has(id)).slice(0, k).forEach((id, i) => ranksOf.get(id)!.push(i + 1))
  }

  // Places obtenues, de la 1re à la K-ième : départage à total égal (plus de
  // 1res places d'abord, puis de 2es…). Égales aussi : vrais ex æquo.
  const placesOf = new Map([...ranksOf].map(([id, ranks]) => [id, Array.from({ length: k }, (_, i) => ranks.filter((r) => r === i + 1).length)]))
  const numberOf = new Map(plates.map((p) => [p.id, p.number]))
  const rows: PlateResult[] = plates.map((p) => {
    const ranks = ranksOf.get(p.id)!
    const votes = ranks.length
    return {
      plateId: p.id,
      position: null,
      score: votes ? ranks.reduce((s, r) => s + k + 1 - r, 0) : null,
      avgRank: votes ? mean(ranks) : null,
      votes,
      bestRank: votes ? Math.min(...ranks) : null,
      worstRank: votes ? Math.max(...ranks) : null,
      firsts: ranks.filter((r) => r === 1).length,
    }
  })

  // < 0 : x devant y. 0 : ex æquo.
  const compare = (x: PlateResult, y: PlateResult) => {
    if (x.score !== y.score) return (y.score ?? -1) - (x.score ?? -1)
    const px = placesOf.get(x.plateId)!
    const py = placesOf.get(y.plateId)!
    const i = px.findIndex((n, j) => n !== py[j])
    return i < 0 ? 0 : py[i] - px[i]
  }
  rows.sort((x, y) => compare(x, y) || numberOf.get(x.plateId)! - numberOf.get(y.plateId)!)

  rows.forEach((r, i) => {
    if (r.score === null) return
    const prev = rows[i - 1]
    r.position = prev && compare(prev, r) === 0 ? prev.position : i + 1
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
