import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const set = vi.fn()
const del = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ set, delete: del }) }))

import { login, logout } from '../auth'
import { ADMIN_COOKIE } from '@/lib/auth'

const submit = (password: string) => {
  const fd = new FormData()
  fd.set('password', password)
  return login(undefined, fd)
}

beforeEach(() => {
  set.mockReset()
  del.mockReset()
  vi.stubEnv('ADMIN_PASSWORD', 'le-vrai-mot-de-passe')
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-secret')
})

afterEach(() => vi.unstubAllEnvs())

test('mot de passe correct : session posée', async () => {
  expect(await submit('le-vrai-mot-de-passe')).toBeUndefined()
  expect(set).toHaveBeenCalledWith(ADMIN_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true }))
})

test('mot de passe faux : refusé, aucune session', async () => {
  expect(await submit('pas-le-bon')).toEqual({ error: 'wrong-password' })
  expect(set).not.toHaveBeenCalled()
})

test('mot de passe vide : refusé hors développement local', async () => {
  expect(await submit('')).toEqual({ error: 'wrong-password' })
  expect(set).not.toHaveBeenCalled()
})

test('ADMIN_PASSWORD absent : personne ne passe, même avec une saisie vide', async () => {
  vi.stubEnv('ADMIN_PASSWORD', '')
  expect(await submit('')).toEqual({ error: 'wrong-password' })
  expect(await submit('nimporte-quoi')).toEqual({ error: 'wrong-password' })
  expect(set).not.toHaveBeenCalled()
})

test('en développement local : n’importe quelle saisie ouvre la session', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  expect(await submit('')).toBeUndefined()
  expect(await submit('nimporte-quoi')).toBeUndefined()
  expect(set).toHaveBeenCalledTimes(2)
})

test('sur Vercel, le contournement ne s’applique pas même en NODE_ENV development', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('VERCEL', '1')
  expect(await submit('nimporte-quoi')).toEqual({ error: 'wrong-password' })
  expect(set).not.toHaveBeenCalled()
})

test('logout supprime le cookie de session', async () => {
  await logout()
  expect(del).toHaveBeenCalledWith(ADMIN_COOKIE)
})
