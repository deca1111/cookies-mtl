import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { DirectionsModal } from '../DirectionsModal'

afterEach(() => {
  cleanup()
})

function renderModal(onClose = vi.fn()) {
  render(
    <LangProvider>
      <DirectionsModal lat={45.5} lng={-73.6} onClose={onClose} />
    </LangProvider>
  )
  return onClose
}

test('3 liens externes : Google Maps, Apple Plans, Waze', () => {
  renderModal()
  const links = screen.getAllByRole('link')
  expect(links).toHaveLength(3)
  for (const l of links) {
    expect(l.getAttribute('target')).toBe('_blank')
    expect(l.getAttribute('rel')).toContain('noopener')
  }
  expect(links.map((l) => l.getAttribute('href') ?? '').join(' ')).toMatch(/google.*apple.*waze|waze/)
})

test('Échap et backdrop ferment', () => {
  const onClose = renderModal()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('dialog'))
  expect(onClose).toHaveBeenCalledTimes(2)
})
