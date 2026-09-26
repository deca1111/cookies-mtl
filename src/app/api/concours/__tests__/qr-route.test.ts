import { beforeEach, expect, test, vi } from 'vitest'

const isAdmin = vi.fn()
const getContestById = vi.fn()
vi.mock('@/lib/auth', () => ({ isAdmin: () => isAdmin() }))
vi.mock('@/lib/contest-db', () => ({ getContestById: (...a: unknown[]) => getContestById(...a) }))
// Satori/Resvg ne tournent pas sous jsdom : on vérifie ce que la route leur passe.
const qrCardImage = vi.fn((..._a: unknown[]) => new Response('png', { headers: { 'Content-Type': 'image/png' } }))
const qrOnlyImage = vi.fn((..._a: unknown[]) => new Response('png', { headers: { 'Content-Type': 'image/png' } }))
vi.mock('@/lib/contest-qr-image', () => ({
  qrCardImage: (...a: unknown[]) => qrCardImage(...a),
  qrOnlyImage: (...a: unknown[]) => qrOnlyImage(...a),
}))

import { GET } from '../../admin/concours/[id]/qr/route'
import { qrFileName } from '@/lib/contest-qr-name'

const call = (qs: string, id = '1') => GET(new Request(`https://cookies.club/api/admin/concours/${id}/qr${qs}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  isAdmin.mockReset().mockResolvedValue(true)
  getContestById.mockReset().mockResolvedValue({ id: 1, name: 'Anniv’ Léo', secret: 'k3f9', phase: 'voting', revealStep: 0 })
  qrCardImage.mockClear(); qrOnlyImage.mockClear()
})

test('401 sans session', async () => {
  isAdmin.mockResolvedValue(false)
  expect((await call('?format=carte')).status).toBe(401)
})

test('400 format invalide, 404 concours inconnu', async () => {
  expect((await call('?format=bof')).status).toBe(400)
  getContestById.mockResolvedValue(null)
  expect((await call('?format=qr')).status).toBe(404)
})

test('carte : URL construite depuis l’origine de la requête, non indexée, jamais en cache', async () => {
  const res = await call('?format=carte')
  expect(res.status).toBe(200)
  expect(qrCardImage).toHaveBeenCalledWith({ url: 'https://cookies.club/concours/k3f9', name: 'Anniv’ Léo' })
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  expect(res.headers.get('Cache-Control')).toBe('no-store')
  expect(res.headers.get('Content-Disposition')).toBeNull()
})

test('qr seul + download : pièce jointe nommée', async () => {
  const res = await call('?format=qr&download=1')
  expect(qrOnlyImage).toHaveBeenCalledWith({ url: 'https://cookies.club/concours/k3f9' })
  expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="concours-anniv-leo-qr.png"')
})

test('nom de fichier : accents et ponctuation retirés', () => {
  expect(qrFileName('Anniv’ Léo !', 'carte')).toBe('concours-anniv-leo-carte.png')
  expect(qrFileName('***', 'qr')).toBe('concours-qr.png')
})
