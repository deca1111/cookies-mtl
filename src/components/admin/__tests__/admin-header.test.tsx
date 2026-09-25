import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AdminHeader } from '../AdminHeader'

afterEach(cleanup)

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

test('lien Concours vers la section concours, même onglet', () => {
  render(<AdminHeader />)
  const link = screen.getByRole('link', { name: /concours/i })
  expect(link.getAttribute('href')).toBe('/admin/concours')
  expect(link.getAttribute('target')).toBeNull()
})
