import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapChrome } from '../MapChrome'

test('pastille logo accessible + crédit Zucchini Studio cliquable', () => {
  render(<MapChrome />)
  expect(screen.getByRole('img', { name: 'Cookies Club' })).toBeDefined()
  const credit = screen.getByRole('link', { name: 'with love by Zucchini Studio' })
  expect(credit.getAttribute('href')).toBe('https://zucchinistudio.com')
  expect(credit.getAttribute('target')).toBe('_blank')
  expect(credit.getAttribute('rel')).toContain('noopener')
})
