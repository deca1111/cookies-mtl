import { isAdmin } from '@/lib/auth'
import { parseContestId } from '@/lib/contest-rules'
import { loadAdminView } from '@/lib/contest-views'

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: HEADERS })
  const id = parseContestId((await params).id)
  const view = id === null ? null : await loadAdminView(id)
  if (!view) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS })
  return Response.json(view, { headers: HEADERS })
}
