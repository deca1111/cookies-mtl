import { isAdmin } from '@/lib/auth'
import { getContestById } from '@/lib/contest-db'
import { qrCardImage, qrOnlyImage } from '@/lib/contest-qr-image'
import { qrFileName } from '@/lib/contest-qr-name'
import { parseContestId } from '@/lib/contest-rules'

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: HEADERS })
  const { searchParams, origin } = new URL(request.url)
  const format = searchParams.get('format')
  if (format !== 'carte' && format !== 'qr') return Response.json({ error: 'format' }, { status: 400, headers: HEADERS })
  const id = parseContestId((await params).id)
  const contest = id === null ? null : await getContestById(id)
  if (!contest) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS })

  // L'origine de la requête : le QR pointe vers le domaine réellement servi
  // (prod, preview, localhost), comme l'ancien QR généré côté client.
  const url = `${origin}/concours/${contest.secret}`
  const image = format === 'carte' ? await qrCardImage({ url, name: contest.name }) : await qrOnlyImage({ url })
  const headers = new Headers(image.headers)
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v)
  if (searchParams.get('download') === '1') headers.set('Content-Disposition', `attachment; filename="${qrFileName(contest.name, format)}"`)
  return new Response(image.body, { status: 200, headers })
}
