import { normalizeName } from './shop-filter'
import { distanceMeters } from './shop-sort'

// Un magasin est « le même » s'il porte le même nom À PROXIMITÉ immédiate.
//
// Le nom seul ne peut pas servir d'identité : la base contient des chaînes (Tim
// Hortons, Subway, Première Moisson…) dont deux succursales distinctes sont des
// fiches légitimes. La position seule ne le peut pas non plus — deux commerces
// différents partagent parfois une adresse (galerie, food court).
//
// 120 m : assez large pour absorber l'écart entre les sources de coordonnées d'un
// même lieu (Photon, lien Google, point posé à la main sur la mini-carte), assez
// serré pour laisser passer deux succursales voisines. En cas de faux positif,
// l'échappatoire est de préciser le nom (« Tim Hortons Sainte-Catherine »), ce qui
// est de toute façon souhaitable pour distinguer les fiches sur la carte.
export const DUPLICATE_RADIUS_M = 120

// Identifiant de lieu Google — la paire « 0x<hex>:0x<hex> » que porte une URL de
// fiche résolue (dans !1s…, ftid=…). C'est une identité EXACTE : deux fiches qui
// la partagent désignent le même commerce, quels que soient l'orthographe du nom
// et l'écart des coordonnées.
//
// Attention : seul le collage d'un lien Google en produit une. Le chemin par
// suggestion Photon passe googleMapsUrl vide, et withListingFallback fabrique
// alors une URL /maps/search/ qui ne fait qu'encoder nom + adresse — aucune
// identité là-dedans, d'où le null. Au 2026-08-11 les 51 fiches de la base sont
// dans ce cas : cette règle ne peut donc pas remplacer le nom + distance, elle
// vient en plus, et se remplira à mesure que des liens seront collés.
export function googlePlaceId(url: string): string | null {
  const m = /(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(url)
  return m ? m[1].toLowerCase() : null
}

type Candidate = { name: string; lat: number; lng: number; googleMapsUrl?: string }

// Renvoie la fiche existante la PLUS PROCHE qui correspond, ou null. `excludeId`
// sert au renommage : une fiche ne doit pas se détecter elle-même en doublon.
export function findDuplicate<
  T extends { id: number; name: string; lat: number; lng: number; googleMapsUrl?: string }
>(shops: readonly T[], candidate: Candidate, excludeId?: number): T | null {
  const others = shops.filter((s) => s.id !== excludeId)

  // 1. Identité Google, quand les deux côtés en portent une : certitude, donc
  //    prioritaire et sans condition de distance.
  const placeId = candidate.googleMapsUrl ? googlePlaceId(candidate.googleMapsUrl) : null
  if (placeId) {
    const sure = others.find((s) => s.googleMapsUrl && googlePlaceId(s.googleMapsUrl) === placeId)
    if (sure) return sure
  }

  // 2. Sinon nom + proximité — le seul recours pour les fiches sans identité
  //    Google, c'est-à-dire toutes celles issues d'une suggestion Photon.
  const name = normalizeName(candidate.name)
  if (!name) return null
  let best: T | null = null
  let bestDistance = Infinity
  for (const shop of others) {
    if (normalizeName(shop.name) !== name) continue
    const d = distanceMeters(candidate, shop)
    if (d <= DUPLICATE_RADIUS_M && d < bestDistance) {
      best = shop
      bestDistance = d
    }
  }
  return best
}
