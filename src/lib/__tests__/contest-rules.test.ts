import { expect, test } from 'vitest'
import { checkBallot, cleanLabel, cleanName, isPhase, nextPlateNumber, parseContestId, shiftPhase, shuffled } from '../contest-rules'

test('phases : avancer et reculer, bornées', () => {
  expect(shiftPhase('preparation', 1)).toBe('voting')
  expect(shiftPhase('voting', -1)).toBe('preparation')
  expect(shiftPhase('reveal', 1)).toBe('reveal')
  expect(shiftPhase('preparation', -1)).toBe('preparation')
  expect(isPhase('closed')).toBe(true)
  expect(isPhase('nope')).toBe(false)
})

test('noms : espaces normalisés, vide ou trop long refusé', () => {
  expect(cleanName('  Julie   M. ')).toBe('Julie M.')
  expect(cleanName('   ')).toBeNull()
  expect(cleanName('x'.repeat(41))).toBeNull()
  expect(cleanName(42)).toBeNull()
})

test('label : facultatif, vide → null, 60 caractères max', () => {
  expect(cleanLabel('  Chocolat noir & sel ')).toBe('Chocolat noir & sel')
  expect(cleanLabel('')).toBeNull()
  expect(cleanLabel(undefined)).toBeNull()
  expect(cleanLabel('x'.repeat(61))).toBe('x'.repeat(60))
})

test('numéro suivant = max + 1, 1 si aucune assiette', () => {
  expect(nextPlateNumber([])).toBe(1)
  expect(nextPlateNumber([3, 1, 7])).toBe(8)
})

test('mélange : permutation des mêmes éléments, déterministe avec un rand fourni', () => {
  const out = shuffled([1, 2, 3, 4], () => 0)
  expect([...out].sort()).toEqual([1, 2, 3, 4])
  expect(out).not.toEqual([1, 2, 3, 4])
})

test('bulletin : entiers autorisés sans doublon, sinon null', () => {
  const allowed = new Set([1, 2, 3])
  expect(checkBallot([3, 1], allowed)).toEqual([3, 1])
  expect(checkBallot([], allowed)).toEqual([])
  expect(checkBallot([1, 1], allowed)).toBeNull()
  expect(checkBallot([1, 9], allowed)).toBeNull()
  expect(checkBallot(['1'], allowed)).toBeNull()
  expect(checkBallot('1,2', allowed)).toBeNull()
})

test('identifiant de concours : entier positif dans les bornes int4, sinon null', () => {
  expect(parseContestId('1')).toBe(1)
  expect(parseContestId('42')).toBe(42)
  expect(parseContestId('2147483647')).toBe(2147483647)
  for (const invalide of ['', ' 1 ', '1.0', '1e20', '0', '-1', '01', '2147483648']) {
    expect(parseContestId(invalide)).toBeNull()
  }
})
