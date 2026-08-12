import { expect, test } from 'vitest'
import { nextSlug, slugify, uniqueSlug } from '../slug'

test('lowercases, strips accents and symbols', () => {
  expect(slugify('Félix & Norton')).toBe('felix-norton')
})

test('collapses whitespace and trims hyphens', () => {
  expect(slugify('  La   Fabrique — de Cookies!  ')).toBe('la-fabrique-de-cookies')
})

test('empty input falls back to "cookie"', () => {
  expect(slugify('!!!')).toBe('cookie')
})

test('uniqueSlug appends -2, -3 on collision', () => {
  const taken = new Set(['felix-norton', 'felix-norton-2'])
  expect(uniqueSlug('Félix & Norton', taken)).toBe('felix-norton-3')
  expect(uniqueSlug('Autre', taken)).toBe('autre')
})

test('nextSlug suit le nom corrigé — le cas des fiches polluées par un lien Google', () => {
  const pollue = 'ciao-amore-cafe-838-avenue-du-mont-royal-e-montreal-qc-h2j-1x1'
  expect(nextSlug(pollue, 'Ciao Amore Café', new Set())).toBe('ciao-amore-cafe')
})

test('nextSlug ne bouge pas quand le nom n’a pas changé', () => {
  expect(nextSlug('felix-norton', 'Félix & Norton', new Set())).toBeNull()
})

test('nextSlug ne fait pas glisser un suffixe légitime à chaque sauvegarde', () => {
  // Une fiche homonyme d'une autre porte « -2 » : elle doit le garder, pas
  // réclamer « -3 » puis « -4 » à chaque enregistrement.
  const autresFiches = new Set(['cafe-x'])
  expect(nextSlug('cafe-x-2', 'Café X', autresFiches)).toBeNull()
})

test('nextSlug évite un slug déjà pris par une voisine', () => {
  expect(nextSlug('ancien-nom', 'Café X', new Set(['cafe-x']))).toBe('cafe-x-2')
})
