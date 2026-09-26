import { expect, test } from 'vitest'
import type { ResultRow } from '../contest-state'
import { podium } from '../contest-podium'

const row = (plateId: number, position: number | null): ResultRow => ({
  plateId, number: plateId, label: null, authors: [], position, score: position === null ? null : 100 - position,
  avgRank: null, votes: 0, bestRank: null, worstRank: null, firsts: 0,
})

test('cas simple : trois marches et le reste', () => {
  const p = podium([row(1, 1), row(2, 2), row(3, 3), row(4, 4), row(5, null)])
  expect(p.first.map((r) => r.plateId)).toEqual([1])
  expect(p.second.map((r) => r.plateId)).toEqual([2])
  expect(p.third.map((r) => r.plateId)).toEqual([3])
  expect(p.rest.map((r) => r.plateId)).toEqual([4, 5])
})

test('deux 1ers ex æquo : pas de 2e, la marche 3 existe', () => {
  const p = podium([row(1, 1), row(2, 1), row(3, 3), row(4, 4)])
  expect(p.first.map((r) => r.plateId)).toEqual([1, 2])
  expect(p.second).toEqual([])
  expect(p.third.map((r) => r.plateId)).toEqual([3])
})

test('moins de 3 assiettes classées', () => {
  const p = podium([row(1, 1), row(2, null)])
  expect(p.first).toHaveLength(1)
  expect(p.second).toEqual([])
  expect(p.third).toEqual([])
  expect(p.rest.map((r) => r.plateId)).toEqual([2])
})
