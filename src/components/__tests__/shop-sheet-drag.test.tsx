import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ShopSheet } from '../ShopSheet'

const shop = {
  id: 1, slug: 'test', name: 'Test', address: '1 rue Test',
  lat: 45.5, lng: -73.5, googleMapsUrl: 'https://maps.google.com/x',
  rating: 4, review: 'Bon.', inProgress: false, createdAt: '2026-01-01T00:00:00.000Z',
}

afterEach(() => cleanup())

function grab(container: HTMLElement) {
  const zone = container.querySelector('[data-drag-zone]')!
  return zone
}

test('glisser vers le bas ferme la fiche', () => {
  const onClose = vi.fn()
  const { container } = render(
    <LangProvider><ShopSheet shop={shop} onClose={onClose} /></LangProvider>
  )
  const zone = grab(container as HTMLElement)
  fireEvent.pointerDown(zone, { clientY: 400, pointerId: 1 })
  fireEvent.pointerUp(zone, { clientY: 500, pointerId: 1 })
  expect(onClose).toHaveBeenCalled()
})

test('glisser vers le haut ne fait rien (cran unique, retour QA v1.1)', () => {
  const onClose = vi.fn()
  const { container } = render(
    <LangProvider><ShopSheet shop={shop} onClose={onClose} /></LangProvider>
  )
  const zone = grab(container as HTMLElement)
  fireEvent.pointerDown(zone, { clientY: 500, pointerId: 1 })
  fireEvent.pointerMove(zone, { clientY: 380, pointerId: 1 })
  fireEvent.pointerUp(zone, { clientY: 380, pointerId: 1 })
  expect(onClose).not.toHaveBeenCalled()
  expect(container.querySelector('.cmtl-sheet')).not.toBeNull() // toujours montée
})

test('un petit glissement lent sous les seuils ne ferme pas', async () => {
  const onClose = vi.fn()
  const { container } = render(
    <LangProvider><ShopSheet shop={shop} onClose={onClose} /></LangProvider>
  )
  const zone = grab(container as HTMLElement)
  fireEvent.pointerDown(zone, { clientY: 400, pointerId: 1 })
  // timeStamp n'est pas injectable via fireEvent : un vrai délai garantit une
  // vélocité < 0,4 px/ms pour un déplacement de 30 px (< seuil de 50 px).
  await new Promise((r) => setTimeout(r, 300))
  fireEvent.pointerUp(zone, { clientY: 430, pointerId: 1 })
  expect(onClose).not.toHaveBeenCalled()
})
