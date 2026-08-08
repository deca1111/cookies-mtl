import { expect, test } from 'vitest'
import { dict } from '../i18n'

test('fr and en have identical, non-empty key sets', () => {
  const frKeys = Object.keys(dict.fr).sort()
  const enKeys = Object.keys(dict.en).sort()
  expect(frKeys).toEqual(enKeys)
  expect(frKeys.length).toBeGreaterThan(0)
  for (const lang of ['fr', 'en'] as const) {
    for (const [k, v] of Object.entries(dict[lang])) {
      expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0)
    }
  }
})
