import { beforeEach, expect, test, vi } from 'vitest'

// vi.hoisted : la fabrique de vi.mock('@/lib/contest-db') parcourt `db` dès son
// exécution (Object.keys), qui a lieu AVANT les déclarations du module de test.
const { db, requireAdmin, loadAdminView } = vi.hoisted(() => {
  const names = [
    'createContest', 'deleteContest', 'renameContest', 'getContestById', 'setPhase', 'setRevealStep', 'addGuest',
    'renameGuest', 'deleteGuest', 'releaseGuest', 'releaseAllGuests', 'addPlate', 'updatePlate', 'deletePlate', 'setPlateNumbers',
    'loadContestData',
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
  addGuestAction, createContestAction, releaseAllGuestsAction, releaseGuestAction, renameContestAction, savePlateAction, setRevealStepAction, shiftPhaseAction,
  shufflePlatesAction,
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
  await shiftPhaseAction(1, 'preparation', 1)
  expect(db.setPhase).toHaveBeenCalledWith(1, 'voting')
})

// Finding #1 : un double clic envoie deux fois la même phase de départ (`from`) —
// les actions serveur étant sérialisées, la première change la phase, la seconde
// doit être rejetée plutôt que de faire sauter un cran de plus.
test('phase : un « from » périmé (double clic) est rejeté, la phase n\'avance pas deux fois', async () => {
  expect(await shiftPhaseAction(1, 'voting', 1)).toEqual({ ok: false, error: 'stale' })
  expect(db.setPhase).not.toHaveBeenCalled()
})

test('phase : concours introuvable', async () => {
  db.getContestById.mockResolvedValue(null)
  expect(await shiftPhaseAction(1, 'preparation', 1)).toEqual({ ok: false, error: 'not-found' })
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

// Finding #6 : un `step` non entier (forgé, ou NaN venu d'un champ vide) doit
// être refusé avant d'atteindre les bornes — jamais silencieusement tronqué.
test('étape de révélation : un pas non entier est refusé', async () => {
  expect(await setRevealStepAction(1, 1.5)).toEqual({ ok: false, error: 'step' })
  expect(await setRevealStepAction(1, NaN)).toEqual({ ok: false, error: 'step' })
  expect(db.getContestById).not.toHaveBeenCalled()
})

// Finding #6 : `authorIds` forgé (absent du tableau) ne doit pas planter `.filter`.
test('assiette : authorIds qui n\'est pas un tableau est refusé', async () => {
  expect(await savePlateAction(1, { label: 'Noisette', authorIds: 'x' as unknown as number[] })).toEqual({ ok: false, error: 'authors' })
  expect(db.addPlate).not.toHaveBeenCalled()
})

test('renommer : nom nettoyé puis enregistré', async () => {
  db.renameContest.mockResolvedValue(true)
  expect(await renameContestAction(1, '  Anniv   Léo ')).toEqual({ ok: true })
  expect(db.renameContest).toHaveBeenCalledWith(1, 'Anniv Léo')
})

test('renommer : nom vide ou trop long refusé, rien écrit', async () => {
  expect(await renameContestAction(1, '   ')).toEqual({ ok: false, error: 'name' })
  expect(await renameContestAction(1, 'x'.repeat(41))).toEqual({ ok: false, error: 'name' })
  expect(db.renameContest).not.toHaveBeenCalled()
})

test('renommer : concours inconnu', async () => {
  db.renameContest.mockResolvedValue(false)
  expect(await renameContestAction(9, 'Anniv')).toEqual({ ok: false, error: 'not-found' })
})

// Même effet que l'invité qui change de nom : le bulletin part avec la
// réservation, sinon il fausse le classement et le prochain à prendre ce nom
// en hériterait.
test('libérer : possible en préparation et pendant le vote', async () => {
  for (const phase of ['preparation', 'voting']) {
    db.releaseGuest.mockReset()
    db.getContestById.mockResolvedValue(contest(phase))
    expect(await releaseGuestAction(1, 5)).toEqual({ ok: true })
    expect(db.releaseGuest).toHaveBeenCalledWith(1, 5)
  }
})

test('libérer : refusé une fois les votes clos, les résultats sont figés', async () => {
  for (const phase of ['closed', 'reveal']) {
    db.getContestById.mockResolvedValue(contest(phase))
    expect(await releaseGuestAction(1, 5)).toEqual({ ok: false, error: 'locked' })
  }
  db.getContestById.mockResolvedValue(null)
  expect(await releaseGuestAction(1, 5)).toEqual({ ok: false, error: 'not-found' })
  expect(db.releaseGuest).not.toHaveBeenCalled()
})

// « Déconnecter tous les téléphones » : tous les noms redeviennent libres et
// les classements partent avec ; invités et assiettes restent.
test('tout libérer : seulement avant la clôture des votes', async () => {
  expect(await releaseAllGuestsAction(1)).toEqual({ ok: true })
  expect(db.releaseAllGuests).toHaveBeenCalledWith(1)
  db.releaseAllGuests.mockReset()
  db.getContestById.mockResolvedValue(contest('closed'))
  expect(await releaseAllGuestsAction(1)).toEqual({ ok: false, error: 'locked' })
  db.getContestById.mockResolvedValue(null)
  expect(await releaseAllGuestsAction(1)).toEqual({ ok: false, error: 'not-found' })
  expect(db.releaseAllGuests).not.toHaveBeenCalled()
})
