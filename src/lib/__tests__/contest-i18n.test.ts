import { expect, test } from 'vitest'
import { contestDict, fmt } from '../contest-i18n'

test('FR et EN ont exactement les mêmes clés, aucune vide', () => {
  expect(Object.keys(contestDict.en).sort()).toEqual(Object.keys(contestDict.fr).sort())
  for (const lang of ['fr', 'en'] as const) {
    for (const v of Object.values(contestDict[lang])) expect(v.trim()).not.toBe('')
  }
})

test('fmt remplace les variables', () => {
  expect(fmt('Assiette {n} — {who}', { n: 4, who: 'Julie' })).toBe('Assiette 4 — Julie')
})
