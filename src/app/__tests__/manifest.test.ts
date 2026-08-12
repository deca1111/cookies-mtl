import { expect, test } from 'vitest'
import manifest from '../manifest'

test('manifest : icônes PWA 192 et 512 en PNG, favicon.ico en secours', () => {
  const icons = manifest().icons ?? []
  const srcs = icons.map((i) => i.src)
  expect(srcs).toContain('/icons/icon-192.png')
  expect(srcs).toContain('/icons/icon-512.png')
  expect(srcs).toContain('/favicon.ico')
  const png192 = icons.find((i) => i.src === '/icons/icon-192.png')
  expect(png192?.sizes).toBe('192x192')
  expect(png192?.type).toBe('image/png')
})

test('manifest : le .ico déclare ses tailles réelles, jamais « any »', () => {
  // 'any' promet une icône vectorielle ; le fichier contient trois images raster
  // (16, 32, 48). Chrome le vérifie et se plaint en console de la contradiction.
  const ico = (manifest().icons ?? []).find((i) => i.src === '/favicon.ico')
  expect(ico?.sizes).toBe('16x16 32x32 48x48')
})
