import { expect, test } from 'vitest'
import { SHEET_CAMERA_OFFSET_Y, SHOP_FOCUS_MIN_ZOOM, shopFocusZoom } from '../camera'

test('zoom plancher : monte à 15, ne dézoome jamais', () => {
  expect(shopFocusZoom(12)).toBe(SHOP_FOCUS_MIN_ZOOM)
  expect(shopFocusZoom(15)).toBe(15)
  expect(shopFocusZoom(16.4)).toBe(16.4)
})

test('l’offset remonte le point au-dessus de la fiche (négatif = vers le haut)', () => {
  expect(SHEET_CAMERA_OFFSET_Y).toBeLessThan(0)
})
