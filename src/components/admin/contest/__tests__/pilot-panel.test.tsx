import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AdminView } from '@/lib/contest-state'

const setRevealStepAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
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
  setRevealStepAction.mockReset()
})

test('étape de révélation : les flèches se désactivent pendant l’envoi', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  setRevealStepAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<PilotPanel view={view('reveal', 0)} onDone={vi.fn()} />)
  const nextStep = screen.getByRole('button', { name: 'Suivante →' })
  fireEvent.click(nextStep)
  await waitFor(() => expect(nextStep.hasAttribute('disabled')).toBe(true))
  fireEvent.click(nextStep)
  resolve({ ok: true })
  await waitFor(() => expect(setRevealStepAction).toHaveBeenCalledTimes(1))
})
