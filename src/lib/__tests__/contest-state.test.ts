import { expect, test } from 'vitest'
import { buildAdminView, buildGuestView, type Contest, type ContestData } from '../contest-state'

const contest = (phase: Contest['phase'], revealStep = 0, topK: number | null = 5): Contest =>
  ({ id: 1, name: 'Anniv', secret: 's3cr3t', phase, revealStep, topK })

// Julie (1) a fait l'assiette 10 ; Marc (2) et Julie ont fait la 20 ; Leo (3) rien.
const data: ContestData = {
  guests: [
    { id: 1, name: 'Julie', claimed: true },
    { id: 2, name: 'Marc', claimed: false },
    { id: 3, name: 'Leo', claimed: true },
  ],
  plates: [
    { id: 10, number: 1, label: 'Noisette', authorIds: [1] },
    { id: 20, number: 2, label: null, authorIds: [1, 2] },
    { id: 30, number: 3, label: null, authorIds: [] },
  ],
  ballots: [
    { guestId: 3, plateIds: [30, 10, 20] },
    { guestId: 2, plateIds: [10, 30] },
  ],
}

test('invite - ses propres assiettes exclues, nom pris par un autre marqué', () => {
  const v = buildGuestView(contest('voting'), data, 1)
  expect(v.me).toEqual({ id: 1, name: 'Julie' })
  expect(v.plates.map((p) => p.id)).toEqual([30])
  expect(v.guests.find((g) => g.id === 3)?.taken).toBe(true)
  expect(v.guests.find((g) => g.id === 1)?.taken).toBe(false)
})

test('invite - ni auteurs ni scores avant l ecran final', () => {
  const v = buildGuestView(contest('reveal', 1), data, 3)
  expect(v.final).toBe(false)
  expect(v.results).toBeNull()
  expect(JSON.stringify(v)).not.toContain('authorIds')
})

test('invite - recapitulatif a l ecran final, avec accord et ses assiettes', () => {
  const steps = buildAdminView(contest('reveal'), data).steps
  const v = buildGuestView(contest('reveal', steps.length - 1), data, 2)
  expect(v.final).toBe(true)
  // Top 5 : Leo [30,10,20] → 30=5, 10=4, 20=3 ; Marc [10,30] → 10=5, 30=4.
  // 10 et 30 : 9 points, une 1re et une 2e place chacun → ex æquo, par numéro.
  expect(v.results?.rows[0]).toMatchObject({ plateId: 10, score: 9, position: 1, authors: ['Julie'] })
  expect(v.results?.rows[1]).toMatchObject({ plateId: 30, score: 9, position: 1 })
  expect(v.topK).toBe(5)
  expect(v.results?.myPlates.map((r) => r.plateId)).toEqual([20])
  expect(v.results?.myPlates[0].authors).toEqual(['Julie', 'Marc'])
  expect(v.myBallot).toEqual([10, 30])
})

test('classement - un vote pour sa propre assiette ne compte pas, même s il date d avant l ajout comme auteur', () => {
  // Julie a classé avant d'être déclarée autrice de la 10 : la 10 sort de son
  // bulletin, la 30 remonte à sa 1re place.
  const late = { ...data, ballots: [...data.ballots, { guestId: 1, plateIds: [10, 30] }] }
  const score = (d: ContestData, id: number) => buildAdminView(contest('voting'), d).rows.find((r) => r.plateId === id)?.score
  expect(score(late, 10)).toBe(score(data, 10))
  expect(score(late, 30)).toBe(score(data, 30)! + 5)
})

test('admin - avancement par invite et nombre de bulletins complets', () => {
  const v = buildAdminView(contest('voting'), data)
  const byName = Object.fromEntries(v.guests.map((g) => [g.name, g]))
  expect(byName['Leo']).toMatchObject({ ranked: 3, rankable: 3 })
  expect(byName['Marc']).toMatchObject({ ranked: 2, rankable: 2 })
  expect(byName['Julie']).toMatchObject({ ranked: 0, rankable: 1, target: 1 })
})

test('admin - classement de chaque invité, en numéros d assiette, meilleur d abord', () => {
  const byName = Object.fromEntries(buildAdminView(contest('voting'), data).guests.map((g) => [g.name, g]))
  expect(byName['Leo'].ballot).toEqual([3, 1, 2])
  expect(byName['Marc'].ballot).toEqual([1, 3])
  expect(byName['Julie'].ballot).toEqual([])
})

test('admin - top K : un bulletin est complet dès que son top est rempli', () => {
  const v = buildAdminView(contest('voting', 0, 2), data)
  const byName = Object.fromEntries(v.guests.map((g) => [g.name, g]))
  // Leo a 3 cookies à classer mais un top 2 : 2 suffisent. Julie n'en a qu'un.
  expect(byName['Leo']).toMatchObject({ ranked: 3, target: 2 })
  expect(byName['Julie']).toMatchObject({ ranked: 0, target: 1 })
  // Mode « tout » : il faut tout classer.
  expect(buildAdminView(contest('voting', 0, null), data).guests.find((g) => g.name === 'Leo')?.target).toBe(3)
})
