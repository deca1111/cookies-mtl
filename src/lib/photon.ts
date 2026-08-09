export type PlaceResult = { name: string; address: string; lat: number; lng: number }

export const MTL_BOUNDS = { latMin: 45.3, latMax: 45.8, lngMin: -74.1, lngMax: -73.3 }

export function withinMontreal(lat: number, lng: number): boolean {
  return lat >= MTL_BOUNDS.latMin && lat <= MTL_BOUNDS.latMax && lng >= MTL_BOUNDS.lngMin && lng <= MTL_BOUNDS.lngMax
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; housenumber?: string; street?: string; city?: string }
}

// Géocodage inverse (spec v1.2 §8) : l'adresse est TOUJOURS dérivée des
// coordonnées quand elle n'est pas fournie par la recherche — jamais saisie.
export async function reverseGeocode(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('lang', 'fr')
  try {
    const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': 'cookies-mtl (personal project)' } })
    if (!res.ok) return null
    const data = (await res.json()) as { features?: PhotonFeature[] }
    const p = data.features?.[0]?.properties
    if (!p) return null
    const address = [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.city]
      .filter(Boolean)
      .join(', ')
    return address || null
  } catch {
    return null
  }
}

export async function searchPlaces(q: string, fetchImpl: typeof fetch = fetch): Promise<PlaceResult[]> {
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('lat', '45.5019')
  url.searchParams.set('lon', '-73.5674')
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'fr')

  try {
    const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': 'cookies-mtl (personal project)' } })
    if (!res.ok) return []
    const data = (await res.json()) as { features?: PhotonFeature[] }
    return (data.features ?? [])
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const p = f.properties
        const address = [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.city]
          .filter(Boolean)
          .join(', ')
        return { name: p.name ?? '', address, lat, lng }
      })
      .filter((r) => r.name.length > 0 && withinMontreal(r.lat, r.lng))
  } catch {
    return []
  }
}
