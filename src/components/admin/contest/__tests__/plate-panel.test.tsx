import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const savePlateAction = vi.fn()
const deletePlateAction = vi.fn()
const shufflePlatesAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
  savePlateAction: (...a: unknown[]) => savePlateAction(...a),
  deletePlateAction: (...a: unknown[]) => deletePlateAction(...a),
  shufflePlatesAction: (...a: unknown[]) => shufflePlatesAction(...a),
}))

import { PlatePanel } from '../PlatePanel'

afterEach(cleanup)

const plates = [{ id: 10, number: 1, label: 'Noisette', authorIds: [] }]

beforeEach(() => {
  savePlateAction.mockReset()
  deletePlateAction.mockReset()
  shufflePlatesAction.mockReset()
})

// Finding #1 : un double clic sur « Enregistrer » avant que la première requête
// ne soit retombée créerait deux assiettes — le bouton doit se désactiver.
test('enregistrement : le bouton se désactive pendant l’envoi, un seul appel part', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  savePlateAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<PlatePanel contestId={1} phase="preparation" plates={[]} guests={[]} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  const save = screen.getByRole('button', { name: 'Enregistrer' })
  fireEvent.click(save)
  await waitFor(() => expect(save.hasAttribute('disabled')).toBe(true))
  fireEvent.click(save)
  resolve({ ok: true })
  await waitFor(() => expect(savePlateAction).toHaveBeenCalledTimes(1))
})

// Finding #4 : suppression sans confirmation détruit des votes — premier clic
// arme le bouton (« Confirmer ? », titre français), second clic déclenche.
test('suppression d’une assiette : confirmation à deux clics', async () => {
  deletePlateAction.mockResolvedValue({ ok: true })
  const onDone = vi.fn()
  render(<PlatePanel contestId={1} phase="preparation" plates={plates} guests={[]} onDone={onDone} />)
  const del = screen.getByRole('button', { name: 'Suppr.' })
  fireEvent.click(del)
  expect(screen.getByRole('button', { name: 'Confirmer ?' })).toBeTruthy()
  expect(deletePlateAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer ?' }))
  await waitFor(() => expect(deletePlateAction).toHaveBeenCalledWith(1, 10))
  expect(onDone).toHaveBeenCalled()
})

test('authorIds invalide (non tableau) : erreur lisible', async () => {
  savePlateAction.mockResolvedValue({ ok: false, error: 'authors' })
  render(<PlatePanel contestId={1} phase="preparation" plates={[]} guests={[]} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.getByText('Auteurs invalides.')).toBeTruthy())
})

test('carte : numéro et auteurs d’abord, note en second', () => {
  render(<PlatePanel contestId={1} phase="voting" onDone={vi.fn()}
    guests={[{ id: 5, name: 'Camille', claimed: false, ranked: 0, rankable: 0, ballot: [] }, { id: 6, name: 'Hugo', claimed: false, ranked: 0, rankable: 0, ballot: [] }]}
    plates={[{ id: 10, number: 1, label: 'pécan caramel', authorIds: [5, 6] }]} />)
  const card = screen.getByRole('button', { name: /Modifier l’assiette 1/ })
  expect(card.textContent).toMatch(/1.*Camille & Hugo.*pécan caramel/)
})

test('clic sur la carte : édition dans la carte, une seule à la fois', () => {
  render(<PlatePanel contestId={1} phase="voting" onDone={vi.fn()} guests={[]}
    plates={[{ id: 10, number: 1, label: null, authorIds: [] }, { id: 11, number: 2, label: null, authorIds: [] }]} />)
  fireEvent.click(screen.getByRole('button', { name: /Modifier l’assiette 1/ }))
  expect(screen.getByPlaceholderText('Note facultative…')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Modifier l’assiette 2/ }))
  expect(screen.getAllByPlaceholderText('Note facultative…')).toHaveLength(1)
  expect(screen.getByRole('button', { name: /Modifier l’assiette 1/ })).toBeTruthy()
})

test('« + Ajouter » : carte provisoire en bas de liste', () => {
  render(<PlatePanel contestId={1} phase="preparation" onDone={vi.fn()} guests={[]}
    plates={[{ id: 10, number: 1, label: null, authorIds: [] }]} />)
  fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  const items = screen.getAllByRole('listitem')
  expect(items[items.length - 1].querySelector('input[placeholder="Note facultative…"]')).not.toBeNull()
})
