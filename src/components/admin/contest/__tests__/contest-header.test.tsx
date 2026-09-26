import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const renameContestAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({ renameContestAction: (...a: unknown[]) => renameContestAction(...a) }))

import { ContestHeader } from '../ContestHeader'

afterEach(cleanup)
beforeEach(() => renameContestAction.mockReset().mockResolvedValue({ ok: true }))

test('retour vers la liste des concours', () => {
  render(<ContestHeader contestId={1} name="Anniv" onDone={vi.fn()} />)
  expect(screen.getByRole('link', { name: /Tous les concours/ }).getAttribute('href')).toBe('/admin/concours')
})

test('crayon → champ, Entrée enregistre puis relit l’état', async () => {
  const onDone = vi.fn()
  render(<ContestHeader contestId={1} name="Anniv" onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Renommer le concours' }))
  const input = screen.getByRole('textbox', { name: 'Nom du concours' })
  fireEvent.change(input, { target: { value: 'Anniv Léo' } })
  fireEvent.submit(input)
  await waitFor(() => expect(renameContestAction).toHaveBeenCalledWith(1, 'Anniv Léo'))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('Échap annule sans appel', () => {
  render(<ContestHeader contestId={1} name="Anniv" onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Renommer le concours' }))
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(renameContestAction).not.toHaveBeenCalled()
})

test('nom refusé : message, le champ reste ouvert', async () => {
  renameContestAction.mockResolvedValue({ ok: false, error: 'name' })
  render(<ContestHeader contestId={1} name="Anniv" onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Renommer le concours' }))
  fireEvent.submit(screen.getByRole('textbox'))
  expect(await screen.findByText('Nom vide ou trop long (40 max).')).toBeTruthy()
  expect(screen.getByRole('textbox')).toBeTruthy()
})
