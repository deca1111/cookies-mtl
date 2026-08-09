import { expect, test } from 'vitest'
import { parseIntroParagraphs } from '../intro-markup'

test('texte simple : un paragraphe, un segment normal', () => {
  expect(parseIntroParagraphs('Bonjour les cookies')).toEqual([[{ text: 'Bonjour les cookies', display: false }]])
})

test('[mots] passe en typo titre, le reste non', () => {
  expect(parseIntroParagraphs('basée sur [mes goûts] surtout')).toEqual([
    [
      { text: 'basée sur ', display: false },
      { text: 'mes goûts', display: true },
      { text: ' surtout', display: false },
    ],
  ])
})

test('une ligne vide sépare les paragraphes, le \\n simple reste dans le paragraphe', () => {
  const paras = parseIntroParagraphs('Ligne 1\nLigne 2\n\nParagraphe 2')
  expect(paras).toHaveLength(2)
  expect(paras[0][0].text).toBe('Ligne 1\nLigne 2')
  expect(paras[1][0].text).toBe('Paragraphe 2')
})

test('crochet jamais refermé : rendu littéral, pas de crash', () => {
  expect(parseIntroParagraphs('oups [pas fermé')).toEqual([[{ text: 'oups [pas fermé', display: false }]])
})

test('paragraphes vides ignorés', () => {
  expect(parseIntroParagraphs('Un\n\n\n\nDeux')).toHaveLength(2)
})
