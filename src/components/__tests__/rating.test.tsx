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

test('size lg grossit les cookies (admin)', () => {
  const { container } = render(<RatingCookies rating={4} size="lg" />)
  expect(container.querySelector('svg')?.getAttribute('width')).toBe('32')
})
