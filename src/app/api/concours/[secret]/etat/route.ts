import { loadGuestView } from '@/lib/contest-views'

// Interrogée toutes les 2,5 s par chaque téléphone. no-store : un état périmé
// servi par un cache intermédiaire figerait l'écran d'un invité.
const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export async function GET(_request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  const view = await loadGuestView(secret)
  if (!view) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS })
  return Response.json(view, { headers: HEADERS })
}
