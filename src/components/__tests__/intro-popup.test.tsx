import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

test('dialogue accessible avec Instagram (sans mail — QA round 3) et fermeture animée', async () => {
  let closed = false
  renderPopup(() => {
    closed = true
  })
  expect(screen.getByRole('dialog')).toBeDefined()
  expect(screen.getByRole('link', { name: /Instagram/ })).toBeDefined()
  expect(screen.queryByRole('link', { name: /Nous écrire|Email/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(screen.getByRole('dialog').getAttribute('data-closing')).toBe('true')
  await waitFor(() => expect(closed).toBe(true))
})

test('Échap ferme la popup (différé par l’animation)', async () => {
  let closed = false
  renderPopup(() => {
    closed = true
  })
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(closed).toBe(true))
})

test('l’animation d’entrée vient du logo, sauf à l’ouverture automatique', () => {
  const { unmount } = renderPopup()
  expect(screen.getByRole('dialog').getAttribute('data-origin')).toBe('logo')
  unmount()
  render(
    <LangProvider>
      <IntroPopup open origin="auto" onClose={() => {}} />
    </LangProvider>
  )
  expect(screen.getByRole('dialog').getAttribute('data-origin')).toBe('auto')
})

test('le toggle FR/EN dans la popup change la langue globale', async () => {
  renderPopup()
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(await screen.findByText(/presentation text coming soon/)).toBeDefined()
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
