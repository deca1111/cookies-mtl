import { expect, test } from 'vitest'
import robots from '../robots'

test('robots.txt exclut l’admin, l’API et les concours', () => {
  const rules = robots().rules
  const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow
  expect(disallow).toEqual(expect.arrayContaining(['/admin', '/api/', '/concours/']))
})
