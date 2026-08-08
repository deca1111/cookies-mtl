import { isAdmin } from '@/lib/auth'
import { searchPlaces } from '@/lib/photon'

export async function GET(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json({ results: [] })
  return Response.json({ results: await searchPlaces(q) })
}
