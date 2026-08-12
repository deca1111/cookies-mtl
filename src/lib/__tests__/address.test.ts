import { expect, test } from 'vitest'
import { hasStreetNumber, preferAddress } from '../address'

test('le numéro civique décide de ce qui situe une fiche', () => {
  expect(hasStreetNumber('1251 Rue Rachel Est, Montréal')).toBe(true)
  expect(hasStreetNumber('Rue Notre-Dame Ouest, Montréal')).toBe(false)
  expect(hasStreetNumber('Montréal')).toBe(false)
  expect(hasStreetNumber('')).toBe(false)
})

test('Photon prime quand son inverse porte le numéro', () => {
  expect(preferAddress('1251 Rue Rachel Est, Montréal', '1251 Rue Rachel E, Montreal')).toBe(
    '1251 Rue Rachel Est, Montréal'
  )
})

test('le lien Google reprend la main quand l’inverse n’a pas de numéro — cas Sora Café', () => {
  expect(preferAddress('Montréal', '1 Pl. Ville-Marie, Montréal')).toBe('1 Pl. Ville-Marie, Montréal')
  expect(preferAddress('', '1 Pl. Ville-Marie, Montréal')).toBe('1 Pl. Ville-Marie, Montréal')
})

test('sans numéro nulle part, l’inverse garde la main pour son format', () => {
  expect(preferAddress('Rue Notre-Dame Ouest, Montréal', 'Notre-Dame St W, Montreal')).toBe(
    'Rue Notre-Dame Ouest, Montréal'
  )
  expect(preferAddress('', 'Place Ville-Marie, Montréal')).toBe('Place Ville-Marie, Montréal')
  expect(preferAddress('', '')).toBe('')
})
