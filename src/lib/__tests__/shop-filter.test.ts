import { expect, test } from 'vitest'
import { filterInProgress, filterShopsByName, normalizeName } from '../shop-filter'

const shops = [
  { name: 'Éclair', inProgress: false },
  { name: 'L’Atelier', inProgress: true },
  { name: 'Miette', inProgress: false },
]

const names = (list: { name: string }[]) => list.map((s) => s.name)

test('recherche : insensible à la casse et aux accents', () => {
  expect(names(filterShopsByName(shops, 'eclair'))).toEqual(['Éclair'])
  expect(names(filterShopsByName(shops, 'ÉCLAIR'))).toEqual(['Éclair'])
})

test('recherche : sous-chaîne, pas seulement le début du nom', () => {
  expect(names(filterShopsByName(shops, 'atelier'))).toEqual(['L’Atelier'])
  expect(names(filterShopsByName(shops, 'ette'))).toEqual(['Miette'])
})

test('recherche vide ou blanche : liste entière', () => {
  expect(filterShopsByName(shops, '')).toHaveLength(3)
  expect(filterShopsByName(shops, '   ')).toHaveLength(3)
})

test('recherche sans correspondance : liste vide', () => {
  expect(filterShopsByName(shops, 'zzz')).toEqual([])
})

test('normalizeName laisse le texte comparable, sans diacritiques ni casse', () => {
  expect(normalizeName('  Crème Brûlée ')).toBe('creme brulee')
})

test('filtre « en cours » : actif = seulement les marquées, inactif = tout', () => {
  expect(names(filterInProgress(shops, true))).toEqual(['L’Atelier'])
  expect(filterInProgress(shops, false)).toHaveLength(3)
})

test('les filtres ne mutent pas la liste source', () => {
  const source = [...shops]
  filterShopsByName(shops, 'e')
  filterInProgress(shops, true)
  expect(shops).toEqual(source)
})
