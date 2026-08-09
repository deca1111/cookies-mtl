import { isAdmin } from '@/lib/auth'
import { reverseGeocode, searchPlaces } from '@/lib/photon'

export async function GET(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  // Géocodage inverse (spec v1.2 §8) : ?lat=&lng= → { address } ; sinon recherche ?q=.
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  if (params.has('lat') && Number.isFinite(lat) && Number.isFinite(lng)) {
    return Response.json({ address: await reverseGeocode(lat, lng) })
  }
  const q = params.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json({ results: [] })
  return Response.json({ results: await searchPlaces(q) })
}
