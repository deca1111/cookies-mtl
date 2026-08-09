import { expect, test } from 'vitest'
import { cookieMarkerHtml } from '../cookie-marker'

test('markup du marqueur : bouton accessible + use du sprite', () => {
  const html = cookieMarkerHtml('Chez "Cookie" & Co')
  expect(html).toContain('class="cmtl-pin-cookie"')
  expect(html).toContain('#cmtl-cookie-full')
  expect(html).toContain('aria-label="Chez &quot;Cookie&quot; &amp; Co"')
})
