import { expect, test } from 'vitest'
import { applyMarkerSelection, cookieMarkerHtml } from '../cookie-marker'

test('markup du marqueur : bouton accessible + use du sprite', () => {
  const html = cookieMarkerHtml('Chez "Cookie" & Co', 'chez-cookie-co')
  expect(html).toContain('class="cmtl-pin-cookie"')
  expect(html).toContain('#cmtl-cookie-full')
  expect(html).toContain('aria-label="Chez &quot;Cookie&quot; &amp; Co"')
})

test('le marqueur porte le slug et la pastille nom', () => {
  const html = cookieMarkerHtml('Le Cookie Shop', 'le-cookie-shop')
  expect(html).toContain('data-slug="le-cookie-shop"')
  expect(html).toContain('cmtl-pin-name')
  expect(html).toContain('>Le Cookie Shop</span>')
})

test('le nom est échappé dans l’attribut ET la pastille', () => {
  const html = cookieMarkerHtml('A&W <Cookies> "MTL"', 'aw')
  expect(html).not.toContain('<Cookies>')
  expect(html).toContain('&lt;Cookies&gt; &quot;MTL&quot;')
})

function mount(slugs: string[]) {
  const root = document.createElement('div')
  root.innerHTML = slugs.map((s) => cookieMarkerHtml(s, s)).join('')
  return root
}

test('applyMarkerSelection marque le sélectionné et estompe les autres', () => {
  const root = mount(['a', 'b', 'c'])
  applyMarkerSelection(root, 'b')
  const [a, b, c] = Array.from(root.querySelectorAll<HTMLElement>('.cmtl-pin-cookie'))
  expect(b.dataset.selected).toBe('true')
  expect(a.dataset.dimmed).toBe('true')
  expect(c.dataset.dimmed).toBe('true')
  expect(a.dataset.selected).toBeUndefined()
})

test('applyMarkerSelection(null) restaure l’état neutre', () => {
  const root = mount(['a', 'b'])
  applyMarkerSelection(root, 'a')
  applyMarkerSelection(root, null)
  for (const el of root.querySelectorAll<HTMLElement>('.cmtl-pin-cookie')) {
    expect(el.dataset.selected).toBeUndefined()
    expect(el.dataset.dimmed).toBeUndefined()
  }
})
