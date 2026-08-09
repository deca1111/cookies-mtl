import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RatingCookies } from '../RatingCookies'

test('3,5 → 3 pleins, 1 demi, 1 contour, label accessible', () => {
  const { container } = render(<RatingCookies rating={3.5} />)
  expect(screen.getByLabelText('3,5 / 5')).toBeDefined()
  expect(container.querySelectorAll('[data-cookie="full"]')).toHaveLength(3)
  expect(container.querySelectorAll('[data-cookie="half"]')).toHaveLength(1)
  expect(container.querySelectorAll('[data-cookie="empty"]')).toHaveLength(1)
  expect(container.textContent).toContain('3,5')
})

test('bornes 0 et 5', () => {
  const zero = render(<RatingCookies rating={0} />)
  expect(zero.container.querySelectorAll('[data-cookie="empty"]')).toHaveLength(5)
  const five = render(<RatingCookies rating={5} />)
  expect(five.container.querySelectorAll('[data-cookie="full"]')).toHaveLength(5)
})

test('variante sheet (défaut) : cookies 27 px, chiffre gras 30 px avec « /5 »', () => {
  const { container } = render(<RatingCookies rating={4.5} />)
  const svgs = container.querySelectorAll('svg')
  expect(svgs).toHaveLength(5)
  expect(svgs[0].getAttribute('width')).toBe('27')
  const num = container.querySelector('.font-display')
  expect(num?.textContent).toContain('4,5')
  expect(container.textContent).toContain('/5')
})

test('variante row : cookies 13 px, chiffre compact sans « /5 »', () => {
  const { container } = render(<RatingCookies rating={4} variant="row" />)
  expect(container.querySelectorAll('svg')[0].getAttribute('width')).toBe('13')
  expect(container.textContent).toContain('4')
  expect(container.textContent).not.toContain('/5')
})

test('variante lg (admin) : cookies 32 px, look historique', () => {
  const { container } = render(<RatingCookies rating={4} variant="lg" />)
  expect(container.querySelector('svg')?.getAttribute('width')).toBe('32')
  expect(container.textContent).not.toContain('/5')
})
