import { expect, test } from 'vitest'
import { agreement, computeResults } from '../contest-scoring'

const A = { id: 10, number: 1 }
const B = { id: 20, number: 2 }
const C = { id: 30, number: 3 }
const D = { id: 40, number: 4 }

test('top K : K points au 1er, un de moins à chaque place, rien au-delà du K-ième', () => {
  const res = computeResults([A, B, C, D], [
    { guestId: 1, plateIds: [10, 20, 30, 40] },
    { guestId: 2, plateIds: [10, 30, 20] },
    { guestId: 3, plateIds: [20, 10] },
  ], 2)
  const byId = Object.fromEntries(res.map((r) => [r.plateId, r]))
  // A : 2 + 2 + 1 ; B : 1 + 2 ; C : 1 (2e de l'invité 2) ; D : hors de tous les tops.
  expect(byId[10]).toMatchObject({ score: 5, votes: 3, firsts: 2, bestRank: 1, worstRank: 2, position: 1 })
  expect(byId[20]).toMatchObject({ score: 3, votes: 2, position: 2 })
  expect(byId[30]).toMatchObject({ score: 1, votes: 1, position: 3 })
  expect(byId[40]).toMatchObject({ score: null, votes: 0, position: null, avgRank: null })
})

test('chaque bulletin distribue les mêmes points, qu’il classe 2 cookies ou tous', () => {
  const full = computeResults([A, B, C, D], [{ guestId: 1, plateIds: [10, 20, 30, 40] }], 2)
  const short = computeResults([A, B, C, D], [{ guestId: 1, plateIds: [10, 20] }], 2)
  const total = (rs: typeof full) => rs.reduce((s, r) => s + (r.score ?? 0), 0)
  expect(total(full)).toBe(3)
  expect(total(short)).toBe(3)
})

test('un bulletin d’un seul cookie compte : c’est un coup de cœur', () => {
  const res = computeResults([A, B], [{ guestId: 1, plateIds: [20] }], 5)
  expect(res[0]).toMatchObject({ plateId: 20, score: 5, position: 1 })
  expect(res[1]).toMatchObject({ plateId: 10, score: null, position: null })
})

test('mode « tout » (K null) : K = nombre de cookies', () => {
  const res = computeResults([A, B, C], [{ guestId: 1, plateIds: [30, 10, 20] }], null)
  expect(res.map((r) => [r.plateId, r.score])).toEqual([[30, 3], [10, 2], [20, 1]])
})

test('cookies sans point en fin de liste, par numéro', () => {
  const res = computeResults([C, B, A], [{ guestId: 1, plateIds: [20] }], 5)
  expect(res.map((r) => r.plateId)).toEqual([20, 10, 30])
})

test('même total : plus de 1res places passe devant, sans être ex æquo', () => {
  const res = computeResults([A, B, C], [
    { guestId: 1, plateIds: [10, 20] },     // A 3, B 2
    { guestId: 2, plateIds: [30, 20, 10] }, // C 3, B 2, A 1
  ], 3)
  // A 4 (une 1re), B 4 (aucune), C 3.
  expect(res.map((r) => [r.plateId, r.score, r.position])).toEqual([[10, 4, 1], [20, 4, 2], [30, 3, 3]])
})

test('même total, mêmes places : ex æquo (1, 1, 3), affichés par numéro', () => {
  const res = computeResults([A, B, C], [
    { guestId: 1, plateIds: [20, 10, 30] }, // B 3, A 2, C 1
    { guestId: 2, plateIds: [10, 20] },     // A 3, B 2
  ], 3)
  // A 5 et B 5, chacun une 1re et une 2e place.
  expect(res.map((r) => [r.plateId, r.score, r.position])).toEqual([[10, 5, 1], [20, 5, 1], [30, 1, 3]])
})

test('un bulletin qui cite un cookie inconnu ne compte pas sa place', () => {
  const res = computeResults([A, B], [{ guestId: 1, plateIds: [99, 10, 20] }], 2)
  expect(res.map((r) => [r.plateId, r.score])).toEqual([[10, 2], [20, 1]])
})

test('accord : identique 100, inversé 0, moins de 3 cookies null', () => {
  expect(agreement([1, 2, 3], [1, 2, 3])).toBe(100)
  expect(agreement([3, 2, 1], [1, 2, 3])).toBe(0)
  expect(agreement([1, 2], [1, 2, 3])).toBeNull()
})

test('accord restreint aux cookies du bulletin', () => {
  // Classement final 1..5 ; l'invité n'a classé que 2, 4, 5 dans le bon ordre.
  expect(agreement([2, 4, 5], [1, 2, 3, 4, 5])).toBe(100)
})
