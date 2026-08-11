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

type Candidate = { name: string; lat: number; lng: number }

// Renvoie la fiche existante la PLUS PROCHE qui correspond, ou null. `excludeId`
// sert au renommage : une fiche ne doit pas se détecter elle-même en doublon.
export function findDuplicate<T extends { id: number; name: string; lat: number; lng: number }>(
  shops: readonly T[],
  candidate: Candidate,
  excludeId?: number
): T | null {
  const name = normalizeName(candidate.name)
  if (!name) return null
  let best: T | null = null
  let bestDistance = Infinity
  for (const shop of shops) {
    if (shop.id === excludeId) continue
    if (normalizeName(shop.name) !== name) continue
    const d = distanceMeters(candidate, shop)
    if (d <= DUPLICATE_RADIUS_M && d < bestDistance) {
      best = shop
      bestDistance = d
    }
  }
  return best
}
