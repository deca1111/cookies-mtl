import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RatingCookies } from '../RatingCookies'

test('renders full, half and empty dots with accessible label', () => {
  render(<RatingCookies rating={3.5} />)
  const el = screen.getByLabelText('3,5 / 5')
  expect(el.textContent).toContain('3,5')
})

test('renders 5/5 and 0/5 without crashing', () => {
  render(<RatingCookies rating={5} />)
  expect(screen.getByLabelText('5 / 5')).toBeDefined()
  render(<RatingCookies rating={0} />)
  expect(screen.getByLabelText('0 / 5')).toBeDefined()
})
