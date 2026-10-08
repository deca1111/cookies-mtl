import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AdminView } from '@/lib/contest-state'

const setRevealStepAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
  setRevealStepAction: (...a: unknown[]) => setRevealStepAction(...a),
}))
// `AccessPanel` gère son propre export/partage PNG (route API, navigator.share…) :
// pas utile ici, testé séparément dans access-panel.test.tsx.
vi.mock('../AccessPanel', () => ({ AccessPanel: () => null }))

import { PilotPanel } from '../PilotPanel'

afterEach(cleanup)

const view = (phase: AdminView['contest']['phase'], revealStep = 0): AdminView => ({
  contest: { id: 1, name: 'Anniv', secret: 's', phase, revealStep },
  guests: [],
  plates: [],
  rows: [],
  steps: [{ kind: 'title' }, { kind: 'final' }],
  complete: 0,
})

beforeEach(() => {
  setRevealStepAction.mockReset()
})

test('étape de révélation : les flèches se désactivent pendant l’envoi', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  setRevealStepAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<PilotPanel view={view('reveal', 0)} onDone={vi.fn()} />)
  const nextStep = screen.getByRole('button', { name: 'Étape ›' })
  fireEvent.click(nextStep)
  await waitFor(() => expect(nextStep.hasAttribute('disabled')).toBe(true))
  fireEvent.click(nextStep)
  resolve({ ok: true })
  await waitFor(() => expect(setRevealStepAction).toHaveBeenCalledTimes(1))
})

test('hors révélation : étapes grisées et explication', () => {
  render(<PilotPanel view={view('voting')} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Étape ›' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Les étapes se débloquent en Révélation.')).toBeTruthy()
})

test('œil : classement masqué par défaut, affiché au clic', () => {
  render(<PilotPanel view={view('voting')} onDone={vi.fn()} />)
  expect(screen.getByText('Masqué. Clique sur l’œil pour l’afficher.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Afficher le classement en direct' }))
  expect(screen.getByRole('button', { name: 'Masquer le classement en direct' })).toBeTruthy()
})

// Le classement est recalculé à chaque relecture de l'état (toutes les 2,5 s) ;
// le bouton la déclenche tout de suite.
test('classement en direct : le bouton rafraîchir relit l’état', () => {
  const onDone = vi.fn()
  render(<PilotPanel view={view('voting')} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Rafraîchir le classement' }))
  expect(onDone).toHaveBeenCalledTimes(1)
})
