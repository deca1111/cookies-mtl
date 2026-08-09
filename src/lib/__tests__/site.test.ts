import { expect, test } from 'vitest'
import { SITE_NAME, SITE_TITLE, SITE_URL, SITE_DESCRIPTION, shopTitle, shopDescription } from '../site'

test('le nom textuel du site est Cookies Club — Montréal', () => {
  expect(SITE_NAME).toBe('Cookies Club — Montréal')
  expect(SITE_URL).toBe('https://cookies.zucchinistudio.com')
})

test('le title couvre les requêtes FR et EN', () => {
  expect(SITE_TITLE).toContain('Cookies Club — Montréal')
  expect(SITE_TITLE.toLowerCase()).toContain('cookie map')
  expect(SITE_DESCRIPTION).toContain('MTL')
})

test('titre et description de fiche', () => {
  expect(shopTitle('Félix & Norton')).toBe('Félix & Norton — Cookies Club Montréal')
  const d = shopDescription({ rating: 4.5, address: '123 rue Rachel E', review: 'Croustillant dehors, fondant dedans.' })
  expect(d).toContain('4,5')
  expect(d).toContain('123 rue Rachel E')
})
