// Identité textuelle et domaine — source unique pour metadata, manifest, sitemap, JSON-LD.
// La marque visuelle (logo) reste « Cookies Club » ; le textuel porte « — Montréal »
// pour le SEO local.
//
// ⚠️ Certaines valeurs sont épinglées par `src/lib/__tests__/site.test.ts` : si un
// test casse après une modification ici, c'est lui qu'il faut aligner sur le
// nouveau wording (le test protège la couverture FR/EN, pas une formulation figée).

// Domaine canonique du site. Impacte : la base de TOUTES les URLs absolues —
// canonical/OG (layout.tsx metadataBase), sitemap.xml, robots.txt, JSON-LD
// (fiches Bakery + avis). Surchargable par la variable d'env NEXT_PUBLIC_SITE_URL
// (previews Vercel). À ne changer qu'en cas de changement de domaine.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cookies.zucchinistudio.com'

// Nom « officiel » long du site. Impacte : og:site_name (partages réseaux sociaux),
// le nom complet de la PWA (manifest), l'auteur des avis dans le JSON-LD, et le
// titre de secours d'une fiche introuvable (/c/[slug]).
export const SITE_NAME = 'Cookies Club — Montréal'

// Marque courte, celle du logo. Impacte : le nom court de la PWA (label sous
// l'icône sur l'écran d'accueil), le gros texte des images de partage OG
// (générées à la volée, prise en compte au prochain déploiement), et le titre
// de la popup explicative.
export const SITE_BRAND = 'Cookies Club'

// Titre de la page d'accueil. Impacte : l'onglet navigateur, le titre affiché
// par Google pour la home, et og:title des partages de la home. C'est LE
// texte SEO principal — garder des mots-clés FR et EN.
export const SITE_TITLE = 'Cookies Club — Montréal · Ma carte des cookies de Montréal · My map of Montreal cookies'

// Description de la page d'accueil. Impacte : la meta description (texte gris
// sous le titre dans Google) et og:description des partages de la home.
export const SITE_DESCRIPTION =
  'Les meilleurs cookies de Montréal, goûtés, notés et cartographiés. ' +
  'The best cookies in Montreal, tasted, rated and mapped.'

// Lien Instagram affiché dans la popup explicative (et nulle part ailleurs).
export const SITE_INSTAGRAM_URL = 'https://www.instagram.com/zucchinistudio/'

// Titre d'une fiche cookie (/c/[slug]). Impacte : l'onglet navigateur, le titre
// Google et og:title de CHAQUE fiche partagée.
export function shopTitle(name: string): string {
  return `${name} — Cookies Club Montréal`
}

// Description d'une fiche cookie (/c/[slug]). Impacte : la meta description
// Google et og:description de chaque fiche (note, adresse, début de l'avis).
export function shopDescription(s: { rating: number; address: string; review: string }): string {
  const note = String(s.rating).replace('.', ',')
  return `Note ${note}/5 · ${s.address} · L'avis Cookies Club — Montréal (MTL) cookie review: ${s.review.slice(0, 100)}`
}
