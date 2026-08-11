import { expect, test } from 'vitest'
import { findDuplicate, googlePlaceId } from '../shop-duplicate'

// Vraie URL de fiche résolue (lien partagé depuis Montréal → google.ca).
const LIEN_FICHE =
  'https://www.google.ca/maps/place/Le+Butterblume/@45.5276,-73.6028,590m/data=!3m1!1e3!4m6!3m5!1s0x4cc9197a6778e4a7:0xed8126bc5d286d24!8m2!3d45.5275!4d-73.6030556'
// Ce que fabrique withListingFallback quand aucun lien n'a été collé.
const LIEN_RECHERCHE = 'https://www.google.com/maps/search/?api=1&query=Bernice%20Rue%20Notre-Dame'

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

test('googlePlaceId : extrait des URL de fiche, null des URL de recherche', () => {
  expect(googlePlaceId(LIEN_FICHE)).toBe('0x4cc9197a6778e4a7:0xed8126bc5d286d24')
  // Les 51 fiches de la base sont dans ce cas : nom + adresse encodés, pas d'identité.
  expect(googlePlaceId(LIEN_RECHERCHE)).toBeNull()
  expect(googlePlaceId('')).toBeNull()
})

test('même identité Google : doublon malgré un nom différent et 5 km d’écart', () => {
  const base = [{ id: 1, name: 'Butterblume', lat: 45.52, lng: -73.58, googleMapsUrl: LIEN_FICHE }]
  const ailleurs = { name: 'Le Butterblume Mile-End', lat: 45.57, lng: -73.62, googleMapsUrl: LIEN_FICHE }
  expect(findDuplicate(base, ailleurs)?.id).toBe(1)
})

test('identités Google différentes : le nom + la distance tranchent quand même', () => {
  const autreLieu = LIEN_FICHE.replace('0xed8126bc5d286d24', '0xaaaaaaaaaaaaaaaa')
  const base = [{ id: 1, name: 'Café Névé', lat: 45.52, lng: -73.58, googleMapsUrl: LIEN_FICHE }]
  // Deux identifiants distincts n'autorisent pas un doublon évident : même nom, même point.
  expect(findDuplicate(base, { name: 'Café Névé', lat: 45.52, lng: -73.58, googleMapsUrl: autreLieu })?.id).toBe(1)
})

test('une URL de recherche des deux côtés ne crée pas de faux positif', () => {
  // Même URL fabriquée mais lieux éloignés : c'est le nom + distance qui décide,
  // et il refuse — sinon deux succursales homonymes deviendraient indissociables.
  const base = [{ id: 1, name: 'Bernice', lat: 45.52, lng: -73.58, googleMapsUrl: LIEN_RECHERCHE }]
  const loin = { name: 'Bernice', lat: 45.57, lng: -73.58, googleMapsUrl: LIEN_RECHERCHE }
  expect(findDuplicate(base, loin)).toBeNull()
})
