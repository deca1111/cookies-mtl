import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MapChrome } from '../MapChrome'

afterEach(() => cleanup())

test('pastille logo accessible + crédit Zucchini Studio cliquable', () => {
  render(<MapChrome cookieCount={51} />)
  expect(screen.getByRole('button', { name: 'Cookies Club' })).toBeDefined()
  const credit = screen.getByRole('link', { name: 'with love by Zucchini Studio' })
  expect(credit.getAttribute('href')).toBe('https://zucchinistudio.com')
  expect(credit.getAttribute('target')).toBe('_blank')
  expect(credit.getAttribute('rel')).toContain('noopener')
})

test('taper la pastille logo ouvre la popup explicative (onLogoClick)', () => {
  let opened = false
  render(<MapChrome cookieCount={51} onLogoClick={() => { opened = true }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cookies Club' }))
  expect(opened).toBe(true)
})

test('le compteur affiche le nombre de cookies, hors du bouton du logo', () => {
  render(<MapChrome cookieCount={51} />)
  expect(screen.getByText('51')).toBeDefined()
  expect(screen.getByText('cookies')).toBeDefined()
  // Détaché de la marque : cliquer le chiffre ne doit pas ouvrir la popup, et le
  // nom accessible du bouton logo reste « Cookies Club » seul.
  const logo = screen.getByRole('button', { name: 'Cookies Club' })
  expect(logo.textContent).not.toContain('51')
})
