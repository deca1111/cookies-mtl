import { expect, test } from 'vitest'
import { moveBy, placeAt, removeFrom } from '../contest-ranking'

test('placer une assiette à une position, ou la déplacer si déjà classée', () => {
  expect(placeAt([], 5, 0)).toEqual([5])
  expect(placeAt([1, 2], 5, 1)).toEqual([1, 5, 2])
  expect(placeAt([1, 2], 5, 9)).toEqual([1, 2, 5])
  expect(placeAt([1, 2, 3], 1, 2)).toEqual([2, 1, 3])
})

test('retirer', () => {
  expect(removeFrom([1, 2, 3], 2)).toEqual([1, 3])
  expect(removeFrom([1], 9)).toEqual([1])
})

test('monter / descendre, borné', () => {
  expect(moveBy([1, 2, 3], 3, -1)).toEqual([1, 3, 2])
  expect(moveBy([1, 2, 3], 1, -1)).toEqual([1, 2, 3])
  expect(moveBy([1, 2, 3], 1, 1)).toEqual([2, 1, 3])
  expect(moveBy([1, 2, 3], 3, 1)).toEqual([1, 2, 3])
})
