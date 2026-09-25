import { expect, test } from 'vitest'
import type { PlateResult } from '../contest-scoring'
import { buildRevealSteps, isFinalStep } from '../contest-reveal'

const row = (plateId: number, position: number | null): PlateResult => ({
  plateId, position, score: position === null ? null : 1 / position, avgRank: position,
  votes: position === null ? 0 : 2, bestRank: position, worstRank: position, firsts: 0,
})

test('titre, puis du dernier au premier en deux temps, puis écran final', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2), row(3, 3), row(4, 4)])
  expect(steps[0]).toEqual({ kind: 'title' })
  expect(steps.slice(1, 3)).toEqual([
    { kind: 'plate', plateIds: [4], position: 4, showAuthors: false, podium: false },
    { kind: 'plate', plateIds: [4], position: 4, showAuthors: true, podium: false },
  ])
  expect(steps[3]).toMatchObject({ plateIds: [3], podium: true, showAuthors: false })
  expect(steps.at(-2)).toMatchObject({ plateIds: [1], position: 1, showAuthors: true })
  expect(steps.at(-1)).toEqual({ kind: 'final' })
  expect(steps).toHaveLength(1 + 4 * 2 + 1)
})

test('ex-aequo reveals together ; no-vote plates only on final screen', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2), row(3, 2), row(4, null)])
  const plateSteps = steps.filter((s) => s.kind === 'plate')
  expect(plateSteps[0]).toMatchObject({ plateIds: [2, 3], position: 2 })
  expect(plateSteps.some((s) => s.kind === 'plate' && s.plateIds.includes(4))).toBe(false)
})

test('isFinalStep', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2)])
  expect(isFinalStep(steps.length - 1, steps)).toBe(true)
  expect(isFinalStep(0, steps)).toBe(false)
  expect(isFinalStep(99, steps)).toBe(true)
})
