// Tri des cookies pour le panneau liste (public) et la liste admin.
// Pur et sans dépendance : testable sans DOM ni carte.
export type SortKey = 'distance' | 'name' | 'rating' | 'recent'
export type SortDir = 'asc' | 'desc'
export type Origin = { lat: number; lng: number }

const EARTH_RADIUS_M = 6371000

export function distanceMeters(a: Origin, b: Origin): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

// « 350 m » sous le kilomètre (arrondi à 10 m), « 1,2 km » au-dessus (virgule
// française, « ,0 » omis).
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  const km = (m / 1000).toFixed(1).replace('.0', '').replace('.', ',')
  return `${km} km`
}

const byName = new Intl.Collator('fr', { sensitivity: 'base' })

export function sortShops<
  T extends { name: string; rating: number; lat: number; lng: number; createdAt?: string }
>(
  shops: readonly T[],
  key: SortKey,
  dir: SortDir,
  origin?: Origin | null
): T[] {
  const sign = dir === 'desc' ? -1 : 1
  const sorted = [...shops]
  if (key === 'distance' && origin) {
    sorted.sort((a, b) => sign * (distanceMeters(origin, a) - distanceMeters(origin, b)))
  } else if (key === 'recent') {
    // `desc` = le plus récent d'abord, comme `rating` desc = la meilleure note
    // d'abord. Ex æquo (import groupé, même horodatage) départagés par le nom.
    const at = (s: T) => (s.createdAt ? Date.parse(s.createdAt) : 0)
    sorted.sort((a, b) => sign * (at(a) - at(b)) || byName.compare(a.name, b.name))
  } else if (key === 'rating') {
    // Ex æquo départagés par le nom pour un ordre stable et prévisible.
    sorted.sort((a, b) => sign * (a.rating - b.rating) || byName.compare(a.name, b.name))
  } else {
    // `name`, ou `distance` sans origine connue : ordre alphabétique ascendant.
    sorted.sort((a, b) => (key === 'name' ? sign : 1) * byName.compare(a.name, b.name))
  }
  return sorted
}
