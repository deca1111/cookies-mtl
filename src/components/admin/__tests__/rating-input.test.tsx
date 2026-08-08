import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RatingInput } from '../RatingInput'

test('clicking right half of 4th cookie yields 4, left half yields 3.5', () => {
  const onChange = vi.fn()
  render(<RatingInput value={0} onChange={onChange} />)
  fireEvent.click(screen.getByTestId('rating-4-full'))
  expect(onChange).toHaveBeenCalledWith(4)
  fireEvent.click(screen.getByTestId('rating-4-half'))
  expect(onChange).toHaveBeenCalledWith(3.5)
})

test('renders current value accessibly', () => {
  render(<RatingInput value={2.5} onChange={() => {}} />)
  expect(screen.getByRole('group', { name: 'Note : 2,5 / 5' })).toBeDefined()
})
