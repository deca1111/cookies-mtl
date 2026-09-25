import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const addGuestAction = vi.fn()
const deleteGuestAction = vi.fn()
const releaseGuestAction = vi.fn()
const renameGuestAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
  addGuestAction: (...a: unknown[]) => addGuestAction(...a),
  deleteGuestAction: (...a: unknown[]) => deleteGuestAction(...a),
  releaseGuestAction: (...a: unknown[]) => releaseGuestAction(...a),
  renameGuestAction: (...a: unknown[]) => renameGuestAction(...a),
}))

import { GuestPanel } from '../GuestPanel'

afterEach(cleanup)

beforeEach(() => {
  addGuestAction.mockReset()
  deleteGuestAction.mockReset()
  releaseGuestAction.mockReset()
  renameGuestAction.mockReset()
})

// Une action qui LÈVE (session admin expirée, coupure réseau…), et pas seulement
// { ok: false }, doit quand même afficher un message et relire l'état — sinon
// c'est une "unhandled promise rejection" muette (cf. runAction.ts).
test('action qui lève : message générique affiché, l’état est quand même relu', async () => {
  addGuestAction.mockRejectedValue(new Error('Unauthorized'))
  const onDone = vi.fn()
  render(<GuestPanel contestId={1} guests={[]} onDone={onDone} />)
  const input = screen.getByPlaceholderText('Ajouter un invité puis Entrée')
  fireEvent.change(input, { target: { value: 'Julie' } })
  fireEvent.submit(input.closest('form')!)
  await waitFor(() => expect(screen.getByText('Action impossible — vérifie ta connexion ou reconnecte-toi.')).toBeTruthy())
  expect(onDone).toHaveBeenCalled()
})
