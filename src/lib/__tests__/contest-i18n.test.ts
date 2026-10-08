import { expect, test } from 'vitest'
import { contestDict, fmt, ordinal } from '../contest-i18n'

test('FR et EN ont exactement les mêmes clés, aucune vide', () => {
  expect(Object.keys(contestDict.en).sort()).toEqual(Object.keys(contestDict.fr).sort())
  for (const lang of ['fr', 'en'] as const) {
    for (const v of Object.values(contestDict[lang])) expect(v.trim()).not.toBe('')
  }
})

test('fmt remplace les variables', () => {
  expect(fmt('Assiette {n} — {who}', { n: 4, who: 'Julie' })).toBe('Assiette 4 — Julie')
})

test('apostrophes typographiques conservées', () => {
  // Vérifier les strings critiques avec apostrophes typographiques (U+2019)
  expect(contestDict.fr.confirm).toBe('C’est moi')
  expect(contestDict.fr.closedTitle).toBe('Votes clos')
  expect(contestDict.en.confirm).toBe('That’s me')
  expect(contestDict.en.offline).toBe('Offline — your ranking will be sent when you’re back online.')

  // Vérifier qu'aucune valeur n'a d'apostrophes droites entre deux lettres
  for (const lang of ['fr', 'en'] as const) {
    for (const [key, value] of Object.entries(contestDict[lang])) {
      expect(value, `${lang}.${key} should not contain straight apostrophes`).not.toMatch(/\p{L}'\p{L}/u)
    }
  }
})

test('ordinaux FR et EN', () => {
  expect([1, 2, 10].map((n) => ordinal('fr', n))).toEqual(['1er', '2e', '10e'])
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map((n) => ordinal('en', n)))
    .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'])
})

test('étiquette d’assiette : « N° X » dans les deux langues', () => {
  expect(contestDict.en.plateTag).toBe(contestDict.fr.plateTag)
})
