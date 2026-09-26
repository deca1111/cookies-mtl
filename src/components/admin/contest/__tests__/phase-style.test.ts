import { expect, test } from 'vitest'
import { PHASES } from '@/lib/contest-rules'
import { phaseColorVar } from '../phase-style'

test('chaque phase a sa variable CSS', () => {
  expect(PHASES.map(phaseColorVar)).toEqual([
    'var(--phase-preparation)', 'var(--phase-voting)', 'var(--phase-closed)', 'var(--phase-reveal)',
  ])
})
