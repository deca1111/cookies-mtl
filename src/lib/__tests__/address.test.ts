import { expect, test } from 'vitest'
import { hasStreetNumber, preferAddress } from '../address'

test('le numéro civique décide de ce qui situe une fiche', () => {
  expect(hasStreetNumber('1251 Rue Rachel Est, Montréal')).toBe(true)
  expect(hasStreetNumber('Rue Notre-Dame Ouest, Montréal')).toBe(false)
  expect(hasStreetNumber('Montréal')).toBe(false)
  expect(hasStreetNumber('')).toBe(false)
})

test('le lien Google prime : lui seul connaît le vrai numéro', () => {
  // Cas réels relevés en base : le géocodage inverse rendait le bâtiment voisin.
  expect(preferAddress('4550 Rue de Rouen, Montréal', '4551 Rue de Rouen, Montréal')).toBe(
    '4551 Rue de Rouen, Montréal'
  )
  expect(preferAddress('501 Place d’Armes, Montréal', '503 Place d’Armes, Montréal')).toBe(
    '503 Place d’Armes, Montréal'
  )
})

test('Photon reprend la main quand le lien ne porte pas d’adresse — cas Bernice', () => {
  expect(preferAddress('Rue Notre-Dame Ouest, Montréal', '')).toBe('Rue Notre-Dame Ouest, Montréal')
  expect(preferAddress('1251 Rue Rachel Est, Montréal', '')).toBe('1251 Rue Rachel Est, Montréal')
})

test('Photon reprend la main quand le lien n’a pas de numéro', () => {
  expect(preferAddress('1251 Rue Rachel Est, Montréal', 'Rue Rachel, Montréal')).toBe(
    '1251 Rue Rachel Est, Montréal'
  )
})

test('sans numéro nulle part, on garde ce qu’on a', () => {
  expect(preferAddress('', 'Place Ville-Marie, Montréal')).toBe('Place Ville-Marie, Montréal')
  expect(preferAddress('Rue Berri, Montréal', '')).toBe('Rue Berri, Montréal')
  expect(preferAddress('', '')).toBe('')
})
