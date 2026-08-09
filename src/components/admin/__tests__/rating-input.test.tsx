import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RatingInput } from '../RatingInput'

test('slider 0→5 par pas de 0,5, câblé à onChange', () => {
  const onChange = vi.fn()
  render(<RatingInput value={3} onChange={onChange} />)
  const slider = screen.getByTestId('rating-slider') as HTMLInputElement
  expect(slider.min).toBe('0')
  expect(slider.max).toBe('5')
  expect(slider.step).toBe('0.5')
  fireEvent.change(slider, { target: { value: '3.5' } })
  expect(onChange).toHaveBeenCalledWith(3.5)
})

test('la visualisation cookies reflète la valeur', () => {
  const { container } = render(<RatingInput value={3.5} onChange={() => {}} />)
  expect(container.querySelectorAll('[data-cookie="full"]')).toHaveLength(3)
  expect(container.querySelectorAll('[data-cookie="half"]')).toHaveLength(1)
  expect(container.textContent).toContain('3,5')
})
