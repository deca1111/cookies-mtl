import { beforeEach, expect, test, vi } from 'vitest'

// vi.hoisted : la fabrique de vi.mock('@/lib/contest-db') parcourt `db` dès son
// exécution (Object.keys), qui a lieu AVANT les déclarations du module de test.
const { db, requireAdmin, loadAdminView } = vi.hoisted(() => {
  const names = [
    'createContest', 'deleteContest', 'getContestById', 'setPhase', 'setRevealStep', 'addGuest', 'renameGuest',
    'deleteGuest', 'releaseGuest', 'addPlate', 'updatePlate', 'deletePlate', 'setPlateNumbers', 'loadContestData',
  ]
  return {
    db: Object.fromEntries(names.map((n) => [n, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
    requireAdmin: vi.fn(),
    loadAdminView: vi.fn(),
  }
})

vi.mock('@/lib/auth', () => ({ requireAdmin: () => requireAdmin() }))
vi.mock('@/lib/contest-identity', () => ({ generateSecret: () => 'SECRET123456' }))
vi.mock('@/lib/contest-views', () => ({ loadAdminView: (...a: unknown[]) => loadAdminView(...a) }))
vi.mock('@/lib/contest-db', () => ({
  isUniqueViolation: (e: unknown) => (e as { code?: string })?.code === '23505',
  ...Object.fromEntries(Object.keys(db).map((k) => [k, (...a: unknown[]) => (db[k] as (...args: unknown[]) => unknown)(...a)])),
}))

import {
  addGuestAction, createContestAction, savePlateAction, setRevealStepAction, shiftPhaseAction, shufflePlatesAction,
} from '../contest-admin'

const contest = (phase: string) => ({ id: 1, name: 'Anniv', secret: 's', phase, revealStep: 0 })
const plates = [
  { id: 10, number: 1, label: null, authorIds: [] },
  { id: 20, number: 2, label: null, authorIds: [] },
]

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined)
  Object.values(db).forEach((f) => f.mockReset())
  loadAdminView.mockReset()
  db.getContestById.mockResolvedValue(contest('preparation'))
  db.loadContestData.mockResolvedValue({ guests: [], plates, ballots: [] })
  db.createContest.mockResolvedValue(42)
})

test('toute action exige la session admin', async () => {
  requireAdmin.mockRejectedValue(new Error('Unauthorized'))
  await expect(createContestAction('Anniv')).rejects.toThrow('Unauthorized')
  expect(db.createContest).not.toHaveBeenCalled()
})

test('création : nom nettoyé, secret généré', async () => {
  expect(await createContestAction('  Anniv  Léo ')).toEqual({ ok: true, id: 42 })
  expect(db.createContest).toHaveBeenCalledWith('Anniv Léo', 'SECRET123456')
  expect(await createContestAction('  ')).toEqual({ ok: false, error: 'name' })
})

test('invité en double : erreur lisible', async () => {
  db.addGuest.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
  expect(await addGuestAction(1, 'Julie')).toEqual({ ok: false, error: 'name-taken' })
})

test('nouvelle assiette : numéro automatique = max + 1', async () => {
  expect(await savePlateAction(1, { label: ' Noisette ', authorIds: [5] })).toEqual({ ok: true })
  expect(db.addPlate).toHaveBeenCalledWith(1, { number: 3, label: 'Noisette', authorIds: [5] })
})

test('assiette modifiée : numéro pris refusé', async () => {
  db.updatePlate.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
  expect(await savePlateAction(1, { id: 10, number: 2, authorIds: [] })).toEqual({ ok: false, error: 'number-taken' })
  expect(await savePlateAction(1, { id: 10, number: 0, authorIds: [] })).toEqual({ ok: false, error: 'number' })
})

test('assiette modifiée hors préparation : le numéro tapé est ignoré, celui en base reste', async () => {
  db.getContestById.mockResolvedValue(contest('voting'))
  expect(await savePlateAction(1, { id: 10, number: 99, label: 'Noisette', authorIds: [] })).toEqual({ ok: true })
  expect(db.updatePlate).toHaveBeenCalledWith(1, 10, { number: 1, label: 'Noisette', authorIds: [] })
})

test('mélange : seulement en préparation, permutation des numéros existants', async () => {
  expect(await shufflePlatesAction(1)).toEqual({ ok: true })
  const pairs = db.setPlateNumbers.mock.calls[0][1] as { plateId: number; number: number }[]
  expect(pairs.map((p) => p.number).sort()).toEqual([1, 2])
  db.getContestById.mockResolvedValue(contest('voting'))
  expect(await shufflePlatesAction(1)).toEqual({ ok: false, error: 'locked' })
})

test('phase : avance d\'un cran', async () => {
  await shiftPhaseAction(1, 1)
  expect(db.setPhase).toHaveBeenCalledWith(1, 'voting')
})

test('étape de révélation : seulement en phase reveal, bornée', async () => {
  expect(await setRevealStepAction(1, 2)).toEqual({ ok: false, error: 'locked' })
  db.getContestById.mockResolvedValue(contest('reveal'))
  loadAdminView.mockResolvedValue({ contest: contest('reveal'), steps: [{}, {}, {}] })
  expect(await setRevealStepAction(1, 99)).toEqual({ ok: true })
  expect(db.setRevealStep).toHaveBeenCalledWith(1, 2)
  expect(await setRevealStepAction(1, -3)).toEqual({ ok: true })
  expect(db.setRevealStep).toHaveBeenLastCalledWith(1, 0)
})
