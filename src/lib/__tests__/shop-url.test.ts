import { expect, test } from 'vitest'
import { shopPath, slugFromPath } from '../shop-url'

test('shopPath : slug → /c/slug, null → /', () => {
  expect(shopPath('felix-norton')).toBe('/c/felix-norton')
  expect(shopPath(null)).toBe('/')
})

test('shopPath encode les caractères spéciaux', () => {
  expect(shopPath('café & co')).toBe('/c/caf%C3%A9%20%26%20co')
})

test('slugFromPath : aller-retour avec shopPath', () => {
  expect(slugFromPath(shopPath('felix-norton'))).toBe('felix-norton')
  expect(slugFromPath(shopPath('café & co'))).toBe('café & co')
})

test('slugFromPath : / et chemins étrangers → null', () => {
  expect(slugFromPath('/')).toBeNull()
  expect(slugFromPath('/admin')).toBeNull()
  expect(slugFromPath('/c/')).toBeNull()
  expect(slugFromPath('/c/a/b')).toBeNull()
})

test('slugFromPath tolère le slash final', () => {
  expect(slugFromPath('/c/miette/')).toBe('miette')
})
