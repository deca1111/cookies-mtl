// Opérations sur le classement d'un invité (liste d'identifiants, meilleur d'abord).
// Pures et immuables : le composant les applique puis envoie le résultat entier.

export function placeAt(ranking: number[], id: number, index: number): number[] {
  const currentIndex = ranking.indexOf(id)
  const rest = ranking.filter((x) => x !== id)
  // Un index désigne une position dans l'affichage ; retirer un élément avant décale la position d'un cran.
  let targetIndex = index
  if (currentIndex >= 0 && currentIndex < index) {
    targetIndex = index - 1
  }
  const i = Math.max(0, Math.min(targetIndex, rest.length))
  return [...rest.slice(0, i), id, ...rest.slice(i)]
}

export function removeFrom(ranking: number[], id: number): number[] {
  return ranking.filter((x) => x !== id)
}

export function moveBy(ranking: number[], id: number, delta: -1 | 1): number[] {
  const i = ranking.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ranking.length) return ranking
  const out = [...ranking]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}
