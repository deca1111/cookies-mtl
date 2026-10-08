import { expect, test } from 'vitest'
import type { PlateResult } from '../contest-scoring'
import { buildRevealSteps, isFinalStep } from '../contest-reveal'

const row = (plateId: number, position: number | null): PlateResult => ({
  plateId, position, score: position === null ? null : 1 / position, avgRank: position,
  votes: position === null ? 0 : 2, bestRank: position, worstRank: position, firsts: 0,
})
// n assiettes classées 1..n, l'id de l'assiette = son rang.
const ranked = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1, i + 1))

test('9 assiettes : titre, rangs du bas groupés, 3e en deux temps, duel, écran final', () => {
  const steps = buildRevealSteps(ranked(9))
  expect(steps).toEqual([
    { kind: 'title' },
    // Du moins bon au meilleur : le tableau se remplit par le bas du classement.
    { kind: 'board', plateIds: [9, 8, 7, 6, 5, 4] },
    { kind: 'plate', plateIds: [3], position: 3, showAuthors: false, podium: true },
    { kind: 'plate', plateIds: [3], position: 3, showAuthors: true, podium: true },
    { kind: 'duel', plateIds: [1, 2], stage: 'intro' },
    { kind: 'duel', plateIds: [1, 2], stage: 'result' },
    { kind: 'duel', plateIds: [1, 2], stage: 'authors' },
    { kind: 'final' },
  ])
})

test('peu d’assiettes sous le podium (3 au plus) : une slide par rang, en deux temps', () => {
  const steps = buildRevealSteps(ranked(6))
  expect(steps.filter((s) => s.kind === 'board')).toEqual([])
  expect(steps.slice(1, 3)).toEqual([
    { kind: 'plate', plateIds: [6], position: 6, showAuthors: false, podium: false },
    { kind: 'plate', plateIds: [6], position: 6, showAuthors: true, podium: false },
  ])
  expect(steps.filter((s) => s.kind === 'plate' && !s.podium)).toHaveLength(3 * 2)
})

test('beaucoup d’assiettes : plusieurs tableaux de taille équilibrée (8 lignes au plus)', () => {
  const boards = buildRevealSteps(ranked(14)).filter((s) => s.kind === 'board')
  expect(boards).toEqual([
    { kind: 'board', plateIds: [14, 13, 12, 11, 10, 9] },
    { kind: 'board', plateIds: [8, 7, 6, 5, 4] },
  ])
})

// Le duel ne trahit pas le vainqueur : ses assiettes sont dans un ordre neutre
// (par id), pas dans l'ordre du classement.
test('duel : ordre neutre, pas celui du classement', () => {
  const steps = buildRevealSteps([row(7, 1), row(3, 2), row(5, 3)])
  expect(steps.find((s) => s.kind === 'duel')).toMatchObject({ plateIds: [3, 7] })
})

test('deux 1ers ex æquo : duel entre les deux, pas de 2e', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 1), row(3, 3)])
  expect(steps.find((s) => s.kind === 'duel')).toMatchObject({ plateIds: [1, 2] })
  expect(steps.filter((s) => s.kind === 'plate').map((s) => s.kind === 'plate' && s.position)).toEqual([3, 3])
})

test('2e ex æquo : finale à trois', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2), row(3, 2), row(4, 4)])
  expect(steps.find((s) => s.kind === 'duel')).toMatchObject({ plateIds: [1, 2, 3] })
})

test('une seule assiette classée : pas de duel, le 1er en deux temps', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, null)])
  expect(steps).toEqual([
    { kind: 'title' },
    { kind: 'menu', plateIds: [2] },
    { kind: 'plate', plateIds: [1], position: 1, showAuthors: false, podium: true },
    { kind: 'plate', plateIds: [1], position: 1, showAuthors: true, podium: true },
    { kind: 'final' },
  ])
})

test('isFinalStep', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2)])
  expect(isFinalStep(steps.length - 1, steps)).toBe(true)
  expect(isFinalStep(0, steps)).toBe(false)
  expect(isFinalStep(99, steps)).toBe(true)
})

// Top K : les cookies cités dans aucun top sont montrés ensemble, sans rang,
// juste après le titre — personne n'est désigné dernier devant la salle.
test('cookies sans point : une étape « aussi au menu » après le titre, hors des tableaux', () => {
  const steps = buildRevealSteps([...ranked(5), row(40, null), row(30, null)])
  expect(steps[1]).toEqual({ kind: 'menu', plateIds: [40, 30] })
  expect(steps.filter((s) => s.kind === 'menu')).toHaveLength(1)
  expect(steps.flatMap((s) => ('plateIds' in s && s.kind !== 'menu' ? s.plateIds : []))).not.toContain(40)
})

test('tous les cookies ont des points : pas d’étape « aussi au menu »', () => {
  expect(buildRevealSteps(ranked(5)).some((s) => s.kind === 'menu')).toBe(false)
})
