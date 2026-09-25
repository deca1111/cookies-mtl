import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AdminView } from '@/lib/contest-state'

const shiftPhaseAction = vi.fn()
const setRevealStepAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
  shiftPhaseAction: (...a: unknown[]) => shiftPhaseAction(...a),
  setRevealStepAction: (...a: unknown[]) => setRevealStepAction(...a),
}))
// `ContestQr` génère un QR async côté client (librairie `qrcode`) : pas utile ici,
// et son `navigator.clipboard` absent de jsdom sortirait un bruit inutile.
vi.mock('../ContestQr', () => ({ ContestQr: () => null }))

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
  shiftPhaseAction.mockReset()
  setRevealStepAction.mockReset()
})

// Finding #1 : un double clic rapproché avant que le premier changement de phase
// ne soit retombé faisait sauter une phase (les actions serveur sont sérialisées).
test('changement de phase : le bouton se désactive pendant l’envoi, un seul appel part', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  shiftPhaseAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<PilotPanel view={view('preparation')} onDone={vi.fn()} />)
  const btn = screen.getByRole('button', { name: /Votes ouverts/ })
  fireEvent.click(btn)
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(true))
  fireEvent.click(btn)
  resolve({ ok: true })
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(false))
  expect(shiftPhaseAction).toHaveBeenCalledTimes(1)
  expect(shiftPhaseAction).toHaveBeenCalledWith(1, 'preparation', 1)
})

// La phase affichée à l'écran (`contest.phase`) est envoyée comme `from` : le
// serveur peut ainsi rejeter un second clic dont le point de départ est périmé.
test('phase périmée (double clic ailleurs) : message dédié, pas de levée', async () => {
  shiftPhaseAction.mockResolvedValue({ ok: false, error: 'stale' })
  render(<PilotPanel view={view('preparation')} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Votes ouverts/ }))
  expect(await screen.findByText('La phase a déjà changé.')).toBeTruthy()
})

test('étape de révélation : les flèches se désactivent pendant l’envoi', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  setRevealStepAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<PilotPanel view={view('reveal', 0)} onDone={vi.fn()} />)
  const nextStep = screen.getByRole('button', { name: 'Suivante →' })
  fireEvent.click(nextStep)
  await waitFor(() => expect(nextStep.hasAttribute('disabled')).toBe(true))
  // Le bouton de phase est lui aussi couvert par le même geste de pilotage.
  expect(screen.getByRole('button', { name: /Votes clos/ }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(nextStep)
  resolve({ ok: true })
  await waitFor(() => expect(setRevealStepAction).toHaveBeenCalledTimes(1))
})
