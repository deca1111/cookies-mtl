// Filtres de la liste admin. Purs et sans dépendance, comme shop-sort.

// Repli casse + accents : « eclair » doit trouver « Éclair », sinon la recherche
// oblige à taper les diacritiques et devient inutilisable au clavier.
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Sous-chaîne, pas préfixe : chercher « atelier » doit trouver « L'Atelier ».
export function filterShopsByName<T extends { name: string }>(shops: readonly T[], query: string): T[] {
  const q = normalizeName(query)
  if (!q) return [...shops]
  return shops.filter((s) => normalizeName(s.name).includes(q))
}

export function filterInProgress<T extends { inProgress: boolean }>(shops: readonly T[], only: boolean): T[] {
  return only ? shops.filter((s) => s.inProgress) : [...shops]
}
