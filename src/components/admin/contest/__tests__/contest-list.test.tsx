import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const createContestAction = vi.fn()
const deleteContestAction = vi.fn()
const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
  createContestAction: (...a: unknown[]) => createContestAction(...a),
  deleteContestAction: (...a: unknown[]) => deleteContestAction(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

import { ContestList } from '../ContestList'

afterEach(cleanup)

const contests = [{ id: 3, name: 'Anniv Léo', phase: 'voting' as const, guestCount: 12, createdAt: '2026-09-25T00:00:00.000Z' }]

beforeEach(() => {
  createContestAction.mockReset().mockResolvedValue({ ok: true, id: 9 })
  deleteContestAction.mockReset().mockResolvedValue({ ok: true })
  push.mockReset()
  refresh.mockReset()
})

test('créer un concours ouvre son pilotage', async () => {
  render(<ContestList contests={[]} />)
  fireEvent.change(screen.getByPlaceholderText('Nom du concours'), { target: { value: 'Anniv' } })
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
  await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/concours/9'))
})

test('suppression : il faut retaper le nom exact', async () => {
  render(<ContestList contests={contests} />)
  fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  const confirm = screen.getByRole('button', { name: 'Supprimer définitivement' })
  expect(confirm.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByPlaceholderText('Anniv Léo'), { target: { value: 'Anniv Léo' } })
  fireEvent.click(confirm)
  await waitFor(() => expect(deleteContestAction).toHaveBeenCalledWith(3))
})

test('création : nom invalide affiche une erreur et ne navigue pas', async () => {
  createContestAction.mockResolvedValue({ ok: false, error: 'name' })
  render(<ContestList contests={[]} />)
  fireEvent.change(screen.getByPlaceholderText('Nom du concours'), { target: { value: 'x'.repeat(41) } })
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
  await waitFor(() => expect(screen.getByText('Nom vide ou trop long (40 max).')).toBeTruthy())
  expect(push).not.toHaveBeenCalled()
})

test('création : bouton désactivé pendant l’envoi', async () => {
  let resolve: (v: { ok: true; id: number }) => void = () => {}
  createContestAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  render(<ContestList contests={[]} />)
  fireEvent.change(screen.getByPlaceholderText('Nom du concours'), { target: { value: 'Anniv' } })
  const button = screen.getByRole('button', { name: 'Créer' })
  fireEvent.click(button)
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
  resolve({ ok: true, id: 9 })
  await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/concours/9'))
})
