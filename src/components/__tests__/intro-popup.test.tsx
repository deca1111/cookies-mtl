import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LangProvider } from '../LangProvider'
import { IntroPopup } from '../IntroPopup'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderPopup(onClose = () => {}) {
  localStorage.setItem('cmtl_lang', 'fr')
  return render(
    <LangProvider>
      <IntroPopup open onClose={onClose} />
    </LangProvider>
  )
}

test('dialogue accessible avec Instagram, mail et fermeture', () => {
  let closed = false
  renderPopup(() => {
    closed = true
  })
  expect(screen.getByRole('dialog')).toBeDefined()
  expect(screen.getByRole('link', { name: /Instagram/ })).toBeDefined()
  expect(screen.getByRole('link', { name: /Nous écrire/ })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(closed).toBe(true)
})

test('Échap ferme la popup', () => {
  let closed = false
  renderPopup(() => {
    closed = true
  })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(closed).toBe(true)
})

test('le toggle FR/EN dans la popup change la langue globale', async () => {
  renderPopup()
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(await screen.findByRole('link', { name: /Email us/ })).toBeDefined()
  expect(localStorage.getItem('cmtl_lang')).toBe('en')
})

test('open=false ne rend rien', () => {
  localStorage.setItem('cmtl_lang', 'fr')
  const { container } = render(
    <LangProvider>
      <IntroPopup open={false} onClose={() => {}} />
    </LangProvider>
  )
  expect(container.querySelector('[role="dialog"]')).toBeNull()
})
