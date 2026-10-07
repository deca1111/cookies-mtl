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
  render(<GuestPanel contestId={1} phase="preparation" guests={[]} onDone={onDone} />)
  const input = screen.getByPlaceholderText('Ajouter un invité puis Entrée')
  fireEvent.change(input, { target: { value: 'Julie' } })
  fireEvent.submit(input.closest('form')!)
  await waitFor(() => expect(screen.getByText('Action impossible — vérifie ta connexion ou reconnecte-toi.')).toBeTruthy())
  expect(onDone).toHaveBeenCalled()
})

// Finding #1 : le champ se désactive pendant l'envoi, un second Entrée avant la
// réponse ne doit pas ajouter le même invité deux fois.
test('ajout : le champ se désactive pendant l’envoi, une seule action part', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  addGuestAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<GuestPanel contestId={1} phase="preparation" guests={[]} onDone={vi.fn()} />)
  const input = screen.getByPlaceholderText('Ajouter un invité puis Entrée')
  fireEvent.change(input, { target: { value: 'Julie' } })
  const form = input.closest('form')!
  fireEvent.submit(form)
  await waitFor(() => expect(input.hasAttribute('disabled')).toBe(true))
  fireEvent.submit(form)
  resolve({ ok: true })
  await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false))
  expect(addGuestAction).toHaveBeenCalledTimes(1)
})

// Finding #4 : suppression sans confirmation détruit des votes — premier clic
// arme le bouton (« Confirmer ? », titre français), second clic déclenche.
test('suppression d’un invité : confirmation à deux clics', async () => {
  deleteGuestAction.mockResolvedValue({ ok: true })
  const onDone = vi.fn()
  render(<GuestPanel contestId={1} phase="preparation" guests={[{ id: 1, name: 'Julie', claimed: false, ranked: 0, rankable: 0 }]} onDone={onDone} />)
  const del = screen.getByRole('button', { name: 'Suppr.' })
  fireEvent.click(del)
  expect(screen.getByRole('button', { name: 'Confirmer ?' })).toBeTruthy()
  expect(deleteGuestAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer ?' }))
  await waitFor(() => expect(deleteGuestAction).toHaveBeenCalledWith(1, 1))
  expect(onDone).toHaveBeenCalled()
})

// Libérer efface le classement de l'invité : même confirmation à deux clics,
// armée indépendamment du « Suppr. » de la même ligne.
test('libérer : confirmation à deux clics, sans armer la suppression', async () => {
  releaseGuestAction.mockResolvedValue({ ok: true })
  render(<GuestPanel contestId={1} phase="voting" guests={[{ id: 1, name: 'Julie', claimed: true, ranked: 2, rankable: 3 }]} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Libérer' }))
  expect(screen.getByRole('button', { name: 'Suppr.' })).toBeTruthy()
  expect(releaseGuestAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer ?' }))
  await waitFor(() => expect(releaseGuestAction).toHaveBeenCalledWith(1, 1))
})

test('libérer : bouton absent une fois les votes clos', () => {
  render(<GuestPanel contestId={1} phase="closed" guests={[{ id: 1, name: 'Julie', claimed: true, ranked: 3, rankable: 3 }]} onDone={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Libérer' })).toBeNull()
})
