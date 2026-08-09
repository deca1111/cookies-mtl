import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapChrome } from '../MapChrome'

test('pastille logo accessible + crédit Zucchini Studio', () => {
  render(<MapChrome />)
  expect(screen.getByRole('img', { name: 'Cookies Club' })).toBeDefined()
  expect(screen.getByText('by Zucchini Studio')).toBeDefined()
})
