import { withinMontreal } from './photon'

export type ShopInput = {
  name: string
  address: string
  lat: number
  lng: number
  googleMapsUrl: string
  rating: number
  review: string
}

type Result = { ok: true; value: ShopInput } | { ok: false; error: string }

export function validateShopInput(raw: Record<string, unknown>): Result {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const address = typeof raw.address === 'string' ? raw.address.trim() : ''
  const review = typeof raw.review === 'string' ? raw.review.trim() : ''
  const googleMapsUrl = typeof raw.googleMapsUrl === 'string' ? raw.googleMapsUrl.trim() : ''
  const lat = Number(raw.lat)
  const lng = Number(raw.lng)
  const rating = Number(raw.rating)

  if (!name || name.length > 200) return { ok: false, error: 'name' }
  if (!address || address.length > 300) return { ok: false, error: 'address' }
  if (review.length > 2000) return { ok: false, error: 'review' }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !withinMontreal(lat, lng)) return { ok: false, error: 'position' }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5 || (rating * 2) % 1 !== 0) return { ok: false, error: 'rating' }
  try {
    if (new URL(googleMapsUrl).protocol !== 'https:') return { ok: false, error: 'googleMapsUrl' }
  } catch {
    return { ok: false, error: 'googleMapsUrl' }
  }

  return { ok: true, value: { name, address, lat, lng, googleMapsUrl, rating, review } }
}
