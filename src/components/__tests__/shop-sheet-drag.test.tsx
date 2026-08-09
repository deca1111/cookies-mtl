import { expect, test, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ShopSheet } from '../ShopSheet'

const shop = {
  id: 1, slug: 'test', name: 'Test', address: '1 rue Test',
  lat: 45.5, lng: -73.5, googleMapsUrl: 'https://maps.google.com/x',
  rating: 4, review: 'Bon.',
}

function grab(container: HTMLElement) {
  const zone = container.querySelector('[data-drag-zone]')!
  return zone
}

test('glisser vers le haut agrandit la fiche', () => {
  const { container } = render(
    <LangProvider><ShopSheet shop={shop} onClose={() => {}} /></LangProvider>
  )
  const sheet = container.querySelector('.cmtl-sheet')!
  expect(sheet.getAttribute('data-expanded')).toBe('false')
  const zone = grab(container as HTMLElement)
  fireEvent.pointerDown(zone, { clientY: 500, pointerId: 1 })
  fireEvent.pointerMove(zone, { clientY: 400, pointerId: 1 })
  fireEvent.pointerUp(zone, { clientY: 400, pointerId: 1 })
  expect(sheet.getAttribute('data-expanded')).toBe('true')
})

test('glisser vers le bas depuis le cran compact ferme', () => {
  const onClose = vi.fn()
  const { container } = render(
    <LangProvider><ShopSheet shop={shop} onClose={onClose} /></LangProvider>
  )
  const zone = grab(container as HTMLElement)
  fireEvent.pointerDown(zone, { clientY: 400, pointerId: 1 })
  fireEvent.pointerUp(zone, { clientY: 500, pointerId: 1 })
  expect(onClose).toHaveBeenCalled()
})

test('glisser vers le bas depuis le cran étendu réduit sans fermer', () => {
  const onClose = vi.fn()
  const { container } = render(
    <LangProvider><ShopSheet shop={shop} onClose={onClose} /></LangProvider>
  )
  const sheet = container.querySelector('.cmtl-sheet')!
  const zone = grab(container as HTMLElement)
  fireEvent.pointerDown(zone, { clientY: 500, pointerId: 1 })
  fireEvent.pointerUp(zone, { clientY: 380, pointerId: 1 }) // agrandit
  fireEvent.pointerDown(zone, { clientY: 300, pointerId: 1 })
  fireEvent.pointerUp(zone, { clientY: 420, pointerId: 1 }) // réduit
  expect(sheet.getAttribute('data-expanded')).toBe('false')
  expect(onClose).not.toHaveBeenCalled()
})
