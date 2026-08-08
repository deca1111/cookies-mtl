import { beforeEach, expect, test, vi } from 'vitest'
import { preferredRenderer, markRasterPreferred, clearRasterPreference } from '../map-renderer'

beforeEach(() => {
  clearRasterPreference()
  localStorage.clear()
  vi.restoreAllMocks()
})

test('webgl par défaut', () => {
  expect(preferredRenderer()).toBe('webgl')
})

test('markRasterPreferred persiste et se relit', () => {
  markRasterPreferred()
  expect(preferredRenderer()).toBe('raster')
  expect(localStorage.getItem('cmtl_renderer')).toBe('raster')
})

test('clearRasterPreference efface tout', () => {
  markRasterPreferred()
  clearRasterPreference()
  expect(preferredRenderer()).toBe('webgl')
  expect(localStorage.getItem('cmtl_renderer')).toBeNull()
})

test('localStorage qui throw -> fallback session, sans exception (mode privé iOS)', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError')
  })
  expect(() => markRasterPreferred()).not.toThrow()
  // la préférence tient au moins pour la session courante
  expect(preferredRenderer()).toBe('raster')
})
