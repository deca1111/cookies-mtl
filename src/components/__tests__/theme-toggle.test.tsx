import { afterEach, expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { ThemeToggle } from '../ThemeToggle'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

test('bascule le thème et son propre libellé', () => {
  document.documentElement.dataset.theme = 'light'
  localStorage.setItem('cmtl_lang', 'fr')
  render(
    <LangProvider>
      <ThemeToggle />
    </LangProvider>
  )
  const btn = screen.getByLabelText('Passer en mode sombre')
  fireEvent.click(btn)
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByLabelText('Passer en mode clair')).toBeDefined()
})
