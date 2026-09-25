import { expect, test } from 'vitest'
import config from '../../../next.config'

test('en-tête noindex sur les pages concours', async () => {
  const rules = await config.headers!()
  const rule = rules.find((r) => r.source === '/concours/:path*')
  expect(rule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
})
