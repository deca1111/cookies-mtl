import { expect, test } from 'vitest'
import { adminManifest } from '../admin-manifest'
import rootManifest from '../../app/manifest'

test('manifest admin : le raccourci iOS ouvre /admin, pas la carte', () => {
  // Le cœur du bug : depuis iOS 16.4, « Sur l'écran d'accueil » suit le start_url
  // du manifest de la page, pas l'URL affichée. Le manifest racine dit '/', d'où
  // un raccourci admin qui retombait sur la carte publique.
  expect(adminManifest().start_url).toBe('/admin')
  expect(rootManifest().start_url).toBe('/')
})

test('manifest admin : identité et périmètre séparés de la PWA publique', () => {
  const admin = adminManifest()
  // Deux manifests sur un même domaine = deux apps distinctes seulement si leurs
  // `id` diffèrent ; sinon le navigateur les confond et une icône écrase l'autre.
  expect(admin.id).toBe('/admin')
  expect(admin.id).not.toBe(rootManifest().id ?? '/')
  expect(admin.scope).toBe('/admin')
  expect(admin.display).toBe('standalone')
})

test('manifest admin : réutilise les icônes du site', () => {
  const srcs = (adminManifest().icons ?? []).map((i) => i.src)
  expect(srcs).toContain('/icons/icon-192.png')
  expect(srcs).toContain('/icons/icon-512.png')
})
