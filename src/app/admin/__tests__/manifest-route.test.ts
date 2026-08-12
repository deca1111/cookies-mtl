import { expect, test } from 'vitest'
import { GET } from '../manifest.webmanifest/route'
import adminLayout, { metadata } from '../layout'

test('le layout admin pointe vers SON manifest, pas celui de la carte', () => {
  // C'est ce <link rel="manifest"> qui décide de la cible du raccourci iOS.
  expect(metadata.manifest).toBe('/admin/manifest.webmanifest')
  expect(typeof adminLayout).toBe('function')
})

test('la route sert le manifest admin avec le bon type MIME', async () => {
  const res = GET()
  expect(res.headers.get('content-type')).toContain('application/manifest+json')
  const body = await res.json()
  expect(body.start_url).toBe('/admin')
  expect(body.scope).toBe('/admin')
})
