import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { THEME_KEY } from '@/lib/theme'
import { ForceDarkTheme } from '../ForceDarkTheme'

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

// Navigation côté client (lien « Concours » depuis l'admin) : le script inline
// ne se rejoue pas, c'est ce composant qui bascule en sombre.
test('entrer dans la partie concours force le sombre sans toucher au choix mémorisé', () => {
  localStorage.setItem(THEME_KEY, 'light')
  document.documentElement.dataset.theme = 'light'
  render(<ForceDarkTheme />)
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem(THEME_KEY)).toBe('light')
})

test('en sortir rend le thème choisi ailleurs sur le site', () => {
  localStorage.setItem(THEME_KEY, 'light')
  const { unmount } = render(<ForceDarkTheme />)
  unmount()
  expect(document.documentElement.dataset.theme).toBe('light')
})
