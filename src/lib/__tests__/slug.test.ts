import { expect, test } from 'vitest'
import { slugify, uniqueSlug } from '../slug'

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
