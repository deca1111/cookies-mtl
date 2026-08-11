import { expect, test } from 'vitest'
import { findDuplicate } from '../shop-duplicate'

// ~111 m par 0,001° de latitude à Montréal : de quoi placer des points à des
// distances choisies de part et d'autre du seuil de 120 m.
const at = (id: number, name: string, latOffset = 0) => ({
  id, name, lat: 45.52 + latOffset, lng: -73.58,
})

const shops = [at(1, 'Café Névé'), at(2, 'Tim Hortons'), at(3, 'Bernice', 0.05)]

test('même nom au même endroit : doublon', () => {
  expect(findDuplicate(shops, { name: 'Café Névé', lat: 45.52, lng: -73.58 })?.id).toBe(1)
})

test('même nom à quelques dizaines de mètres : doublon (sources de coordonnées différentes)', () => {
  // 0,0005° ≈ 55 m — l'écart typique entre Photon et un lien Google pour un même lieu.
  expect(findDuplicate(shops, { name: 'Café Névé', lat: 45.5205, lng: -73.58 })?.id).toBe(1)
})

test('nom identique à la casse et aux accents près : doublon', () => {
  expect(findDuplicate(shops, { name: '  cafe neve  ', lat: 45.52, lng: -73.58 })?.id).toBe(1)
})

test('même nom mais loin : succursale distincte, PAS un doublon', () => {
  // 0,005° ≈ 555 m : deux Tim Hortons de quartiers différents restent ajoutables.
  expect(findDuplicate(shops, { name: 'Tim Hortons', lat: 45.525, lng: -73.58 })).toBeNull()
})

test('même endroit mais nom différent : PAS un doublon (galerie, food court)', () => {
  expect(findDuplicate(shops, { name: 'Autre Café', lat: 45.52, lng: -73.58 })).toBeNull()
})

test('renommage : une fiche ne se détecte pas elle-même', () => {
  expect(findDuplicate(shops, { name: 'Café Névé', lat: 45.52, lng: -73.58 }, 1)).toBeNull()
})

test('plusieurs candidats : renvoie le plus proche', () => {
  const proches = [at(1, 'Cookie', 0.0009), at(2, 'Cookie', 0.0002)]
  expect(findDuplicate(proches, { name: 'Cookie', lat: 45.52, lng: -73.58 })?.id).toBe(2)
})

test('nom vide : aucun doublon (rien à comparer)', () => {
  expect(findDuplicate(shops, { name: '   ', lat: 45.52, lng: -73.58 })).toBeNull()
})
