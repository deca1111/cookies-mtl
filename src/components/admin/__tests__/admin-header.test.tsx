import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminHeader } from '../AdminHeader'

test('lien Voir la carte vers la carte publique, nouvel onglet', () => {
  render(<AdminHeader />)
  const link = screen.getByRole('link', { name: /voir la carte/i })
  expect(link.getAttribute('href')).toBe('/')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
})

test('le titre est Admin, sans emoji', () => {
  render(<AdminHeader />)
  const headings = screen.getAllByRole('heading')
  expect(headings[0].textContent).toBe('Admin')
})
