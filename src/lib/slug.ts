export function slugify(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'cookie'
}

export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// Le slug d'une fiche suit son nom (spec 2026-08-11 §3). Renvoie le slug à
// prendre, ou null quand il n'y a rien à changer — le cas courant, puisque la
// plupart des enregistrements ne touchent pas au nom.
//
// `taken` doit exclure la fiche elle-même : sinon son propre slug la ferait
// glisser d'un cran à chaque sauvegarde (« -2 », « -3 »…). Le null couvre aussi
// la fiche qui porte déjà un suffixe légitime : « Café X » derrière un homonyme
// garde `cafe-x-2` au lieu d'en réclamer un nouveau à chaque passage.
export function nextSlug(currentSlug: string, name: string, taken: Set<string>): string | null {
  const candidate = uniqueSlug(name, taken)
  return candidate === currentSlug ? null : candidate
}
