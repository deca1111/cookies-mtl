import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const shiftPhaseAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({ shiftPhaseAction: (...a: unknown[]) => shiftPhaseAction(...a) }))

import { PhaseTimeline } from '../PhaseTimeline'

afterEach(cleanup)
// Bloc, pas d'expression : `mockReset()`/`mockResolvedValue()` renvoient le
// mock lui-même (une fonction) — en expression, `beforeEach` le renverrait et
// Vitest le prendrait pour un teardown implicite, rappelant l'action après
// coup et restant en attente d'une promesse jamais résolue (timeout de hook).
beforeEach(() => { shiftPhaseAction.mockReset().mockResolvedValue({ ok: true }) })

const guest = (id: number, claimed: boolean, ranked: number, target: number) =>
  ({ id, name: `G${id}`, claimed, ranked, rankable: 8, target, ballot: [] })
// 2 complets (dont un qui classe au-delà de son top), 1 en cours, 1 pas commencé, 1 libre.
const guests = [guest(1, true, 5, 5), guest(2, true, 7, 5), guest(3, true, 2, 5), guest(4, true, 0, 5), guest(5, false, 0, 5)]
const renderAt = (phase: 'preparation' | 'voting' | 'closed' | 'reveal') =>
  render(<PhaseTimeline contestId={1} phase={phase} guests={guests} onDone={vi.fn()} />)

test('les 4 étapes, la courante marquée', () => {
  renderAt('voting')
  for (const l of ['Préparation', 'Votes ouverts', 'Votes clos', 'Révélation']) expect(screen.getAllByText(l).length).toBeGreaterThan(0)
  expect(screen.getByText('Votes ouverts', { selector: '[aria-current="step"]' })).toBeTruthy()
})

test('boutons précédent / suivant autour de la frise, absents aux extrémités', () => {
  renderAt('preparation')
  expect(screen.queryByRole('button', { name: /‹/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Votes ouverts ›' })).toBeTruthy()
  cleanup()
  renderAt('reveal')
  expect(screen.getByRole('button', { name: '‹ Votes clos' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /›/ })).toBeNull()
})

test('avancement des bulletins sous la frise, du plus avancé au moins avancé', () => {
  renderAt('voting')
  expect([...screen.getByTestId('guest-summary').querySelectorAll('li')].map((li) => li.textContent))
    .toEqual(['2 complets', '1 en cours', '1 pas commencé', '1 pas connecté'])
})

test('changement de phase : un seul appel malgré le double clic', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  shiftPhaseAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  renderAt('preparation')
  const btn = screen.getByRole('button', { name: 'Votes ouverts ›' })
  fireEvent.click(btn)
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(true))
  fireEvent.click(btn)
  resolve({ ok: true })
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(false))
  expect(shiftPhaseAction).toHaveBeenCalledTimes(1)
  expect(shiftPhaseAction).toHaveBeenCalledWith(1, 'preparation', 1)
})

test('phase périmée : message dédié', async () => {
  shiftPhaseAction.mockResolvedValue({ ok: false, error: 'stale' })
  renderAt('preparation')
  fireEvent.click(screen.getByRole('button', { name: 'Votes ouverts ›' }))
  expect(await screen.findByText('La phase a déjà changé.')).toBeTruthy()
})
