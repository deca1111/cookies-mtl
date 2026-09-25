import { expect, test } from 'vitest'
import { agreement, computeResults } from '../contest-scoring'

const A = { id: 10, number: 1 }
const B = { id: 20, number: 2 }
const C = { id: 30, number: 3 }
const D = { id: 40, number: 4 }

test('score normalisé, rang moyen, stats et ordre final', () => {
  const res = computeResults([A, B, C], [
    { guestId: 1, plateIds: [10, 20, 30] },
    { guestId: 2, plateIds: [10, 30, 20] },
    { guestId: 3, plateIds: [20, 10, 30] },
  ])
  expect(res.map((r) => r.plateId)).toEqual([10, 20, 30])
  expect(res.map((r) => r.position)).toEqual([1, 2, 3])
  expect(res[0].score).toBeCloseTo(5 / 6)
  expect(res[1].score).toBeCloseTo(0.5)
  expect(res[2].score).toBeCloseTo(1 / 6)
  expect(res[0].avgRank).toBeCloseTo(4 / 3)
  expect(res[0]).toMatchObject({ votes: 3, bestRank: 1, worstRank: 2, firsts: 2 })
})

test('bulletin de moins de 2 assiettes ignoré, bulletin partiel compté', () => {
  const res = computeResults([A, B, C], [
    { guestId: 1, plateIds: [30] },
    { guestId: 2, plateIds: [10, 20] },
  ])
  const byId = Object.fromEntries(res.map((r) => [r.plateId, r]))
  expect(byId[10].score).toBe(1)
  expect(byId[20].score).toBe(0)
  expect(byId[30]).toMatchObject({ score: null, votes: 0, position: null, avgRank: null })
})

test('assiette sans voix en fin de classement, par numéro', () => {
  const res = computeResults([C, B, A], [{ guestId: 1, plateIds: [20, 10] }])
  expect(res.map((r) => r.plateId)).toEqual([20, 10, 30])
})

test('ex æquo : même position (1, 2, 2, 4), départage d\'affichage par rang moyen puis numéro', () => {
  const res = computeResults([A, B, C, D], [
    { guestId: 1, plateIds: [10, 20, 30, 40] },
    { guestId: 2, plateIds: [10, 30, 20, 40] },
  ])
  expect(res.map((r) => r.plateId)).toEqual([10, 20, 30, 40])
  expect(res.map((r) => r.position)).toEqual([1, 2, 2, 4])
})

test('même note, rang moyen différent : même position, meilleur rang moyen affiché d\'abord', () => {
  const res = computeResults([A, B, C, D], [
    { guestId: 1, plateIds: [30, 10, 40] }, // C=1 (r1), A=0,5 (r2), D=0 (r3)
    { guestId: 2, plateIds: [20, 30] },     // B=1 (r1), C=0 (r2)
    { guestId: 3, plateIds: [30, 20] },     // C=1 (r1), B=0 (r2)
  ])
  // C : 2/3 ; A : 0,5 (rang moy 2) ; B : 0,5 (rang moy 1,5) ; D : 0.
  // A et B sont ex æquo ; B passe devant malgré son numéro plus grand.
  expect(res.map((r) => r.plateId)).toEqual([30, 20, 10, 40])
  expect(res.map((r) => r.position)).toEqual([1, 2, 2, 4])
})

test('un bulletin qui cite une assiette inconnue ne la compte pas', () => {
  const res = computeResults([A, B], [{ guestId: 1, plateIds: [10, 99, 20] }])
  expect(res.find((r) => r.plateId === 20)?.score).toBe(0)
})

test('accord : identique 100, inversé 0, moins de 3 assiettes null', () => {
  expect(agreement([1, 2, 3], [1, 2, 3])).toBe(100)
  expect(agreement([3, 2, 1], [1, 2, 3])).toBe(0)
  expect(agreement([1, 2], [1, 2, 3])).toBeNull()
})

test('accord restreint aux assiettes du bulletin', () => {
  // Classement final 1..5 ; l'invité n'a classé que 2, 4, 5 dans le bon ordre.
  expect(agreement([2, 4, 5], [1, 2, 3, 4, 5])).toBe(100)
})
