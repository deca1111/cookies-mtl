import { beforeEach, expect, test, vi } from 'vitest'

const db = {
  getContestBySecret: vi.fn(),
  claimGuest: vi.fn(),
  findGuestIdByToken: vi.fn(),
  loadContestData: vi.fn(),
  replaceBallot: vi.fn(),
  releaseSelf: vi.fn(),
}
const identity = { generateClaimToken: vi.fn(), readGuestToken: vi.fn(), writeGuestToken: vi.fn(), clearGuestToken: vi.fn() }
vi.mock('@/lib/contest-db', () => ({
  getContestBySecret: (...a: unknown[]) => db.getContestBySecret(...a),
  claimGuest: (...a: unknown[]) => db.claimGuest(...a),
  findGuestIdByToken: (...a: unknown[]) => db.findGuestIdByToken(...a),
  loadContestData: (...a: unknown[]) => db.loadContestData(...a),
  replaceBallot: (...a: unknown[]) => db.replaceBallot(...a),
  releaseSelf: (...a: unknown[]) => db.releaseSelf(...a),
}))
vi.mock('@/lib/contest-identity', () => ({
  generateClaimToken: () => identity.generateClaimToken(),
  readGuestToken: (...a: unknown[]) => identity.readGuestToken(...a),
  writeGuestToken: (...a: unknown[]) => identity.writeGuestToken(...a),
  clearGuestToken: (...a: unknown[]) => identity.clearGuestToken(...a),
}))

import { claimNameAction, saveBallotAction, releaseSelfAction } from '../contest-guest'

const contest = { id: 1, name: 'Anniv', secret: 's', phase: 'voting', revealStep: 0 }
const data = {
  guests: [{ id: 5, name: 'Julie', claimed: true }],
  plates: [
    { id: 10, number: 1, label: null, authorIds: [5] },
    { id: 20, number: 2, label: null, authorIds: [] },
    { id: 30, number: 3, label: null, authorIds: [] },
  ],
  ballots: [],
}

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset())
  Object.values(identity).forEach((f) => f.mockReset())
  db.getContestBySecret.mockResolvedValue(contest)
  db.claimGuest.mockResolvedValue(true)
  db.findGuestIdByToken.mockResolvedValue(5)
  db.loadContestData.mockResolvedValue(data)
  identity.generateClaimToken.mockReturnValue('tok')
  identity.readGuestToken.mockResolvedValue('tok')
})

test('choisir un nom libre : jeton posé en base et en cookie', async () => {
  expect(await claimNameAction('s', 5)).toEqual({ ok: true })
  expect(db.claimGuest).toHaveBeenCalledWith(1, 5, 'tok')
  expect(identity.writeGuestToken).toHaveBeenCalledWith(1, 'tok')
})

test('nom déjà pris : refusé, aucun cookie', async () => {
  db.claimGuest.mockResolvedValue(false)
  expect(await claimNameAction('s', 5)).toEqual({ ok: false, error: 'taken' })
  expect(identity.writeGuestToken).not.toHaveBeenCalled()
})

test('concours inconnu', async () => {
  db.getContestBySecret.mockResolvedValue(null)
  expect(await claimNameAction('x', 5)).toEqual({ ok: false, error: 'not-found' })
  expect(await saveBallotAction('x', [20])).toEqual({ ok: false, error: 'not-found' })
})

test('bulletin valide enregistré en entier', async () => {
  expect(await saveBallotAction('s', [30, 20])).toEqual({ ok: true })
  expect(db.replaceBallot).toHaveBeenCalledWith(5, [30, 20])
})

test('sans identité valide : refusé', async () => {
  db.findGuestIdByToken.mockResolvedValue(null)
  expect(await saveBallotAction('s', [20])).toEqual({ ok: false, error: 'no-identity' })
  identity.readGuestToken.mockResolvedValue(null)
  expect(await saveBallotAction('s', [20])).toEqual({ ok: false, error: 'no-identity' })
  expect(db.replaceBallot).not.toHaveBeenCalled()
})

test('hors phase de vote : refusé', async () => {
  db.getContestBySecret.mockResolvedValue({ ...contest, phase: 'closed' })
  expect(await saveBallotAction('s', [20])).toEqual({ ok: false, error: 'closed' })
  expect(db.replaceBallot).not.toHaveBeenCalled()
})

test('sa propre assiette, une assiette inconnue ou un doublon : refusé', async () => {
  expect(await saveBallotAction('s', [10, 20])).toEqual({ ok: false, error: 'invalid' })
  expect(await saveBallotAction('s', [99])).toEqual({ ok: false, error: 'invalid' })
  expect(await saveBallotAction('s', [20, 20])).toEqual({ ok: false, error: 'invalid' })
  expect(db.replaceBallot).not.toHaveBeenCalled()
})

test('changer de nom en vote : bulletin effacé, jeton vidé, cookie supprimé', async () => {
  expect(await releaseSelfAction('s')).toEqual({ ok: true })
  expect(db.releaseSelf).toHaveBeenCalledWith(1, 5)
  expect(identity.clearGuestToken).toHaveBeenCalledWith(1)
})

test('changer de nom en préparation : autorisé', async () => {
  db.getContestBySecret.mockResolvedValue({ ...contest, phase: 'preparation' })
  expect(await releaseSelfAction('s')).toEqual({ ok: true })
})

test('changer de nom après la clôture : refusé, rien touché', async () => {
  for (const phase of ['closed', 'reveal']) {
    db.getContestBySecret.mockResolvedValue({ ...contest, phase })
    expect(await releaseSelfAction('s')).toEqual({ ok: false, error: 'locked' })
  }
  expect(db.releaseSelf).not.toHaveBeenCalled()
  expect(identity.clearGuestToken).not.toHaveBeenCalled()
})

test('changer de nom sans identité ou concours inconnu', async () => {
  db.findGuestIdByToken.mockResolvedValue(null)
  expect(await releaseSelfAction('s')).toEqual({ ok: false, error: 'no-identity' })
  db.getContestBySecret.mockResolvedValue(null)
  expect(await releaseSelfAction('x')).toEqual({ ok: false, error: 'not-found' })
  expect(db.releaseSelf).not.toHaveBeenCalled()
})
