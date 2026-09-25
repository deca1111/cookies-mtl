import { beforeEach, expect, test, vi } from 'vitest'

const loadGuestView = vi.fn()
const loadAdminView = vi.fn()
const isAdmin = vi.fn()
vi.mock('@/lib/contest-views', () => ({
  loadGuestView: (...a: unknown[]) => loadGuestView(...a),
  loadAdminView: (...a: unknown[]) => loadAdminView(...a),
}))
vi.mock('@/lib/auth', () => ({ isAdmin: () => isAdmin() }))

import { GET as guestGET } from '../[secret]/etat/route'
import { GET as adminGET } from '../../admin/concours/[id]/etat/route'

beforeEach(() => {
  loadGuestView.mockReset().mockResolvedValue({ name: 'Anniv' })
  loadAdminView.mockReset().mockResolvedValue({ contest: { id: 1 } })
  isAdmin.mockReset().mockResolvedValue(true)
})

const req = new Request('http://x')

test('invité : état, non indexé, jamais mis en cache', async () => {
  const res = await guestGET(req, { params: Promise.resolve({ secret: 'abc' }) })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ name: 'Anniv' })
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  expect(res.headers.get('Cache-Control')).toBe('no-store')
  expect(loadGuestView).toHaveBeenCalledWith('abc')
})

test('invité : secret inconnu → 404', async () => {
  loadGuestView.mockResolvedValue(null)
  const res = await guestGET(req, { params: Promise.resolve({ secret: 'nope' }) })
  expect(res.status).toBe(404)
})

test('admin : 401 sans session, 404 id invalide, état sinon', async () => {
  isAdmin.mockResolvedValue(false)
  expect((await adminGET(req, { params: Promise.resolve({ id: '1' }) })).status).toBe(401)
  isAdmin.mockResolvedValue(true)
  expect((await adminGET(req, { params: Promise.resolve({ id: 'abc' }) })).status).toBe(404)
  const res = await adminGET(req, { params: Promise.resolve({ id: '1' }) })
  expect(res.status).toBe(200)
  expect(loadAdminView).toHaveBeenCalledWith(1)
})

test('admin : identifiant hors bornes (1e20) → 404 sans interroger la base', async () => {
  const res = await adminGET(req, { params: Promise.resolve({ id: '1e20' }) })
  expect(res.status).toBe(404)
  expect(loadAdminView).not.toHaveBeenCalled()
})
