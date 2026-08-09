// Identité textuelle et domaine — source unique pour metadata, manifest, sitemap, JSON-LD.
// La marque visuelle (logo) reste « Cookies Club » ; le textuel porte « — Montréal »
// pour le SEO local (requêtes : cookie map, cookie montréal, cookies mtl…).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cookies.zucchinistudio.com'
export const SITE_NAME = 'Cookies Club — Montréal'
export const SITE_BRAND = 'Cookies Club'
export const SITE_TITLE = "Cookies Club — Montréal · La carte des cookies · Montreal's cookie map"
export const SITE_DESCRIPTION =
  'Les meilleurs cookies de Montréal (MTL), goûtés, notés et cartographiés. ' +
  'The best cookies in Montreal, tasted, rated and mapped by Cookies Club.'

export function shopTitle(name: string): string {
  return `${name} — Cookies Club Montréal`
}

export function shopDescription(s: { rating: number; address: string; review: string }): string {
  const note = String(s.rating).replace('.', ',')
  return `Note ${note}/5 · ${s.address} · L'avis Cookies Club — Montréal (MTL) cookie review: ${s.review.slice(0, 100)}`
}
