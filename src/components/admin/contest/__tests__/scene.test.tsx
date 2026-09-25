import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AdminView } from '@/lib/contest-state'

const setRevealStepAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({ setRevealStepAction: (...a: unknown[]) => setRevealStepAction(...a) }))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))

import { Scene } from '../Scene'

afterEach(cleanup)

beforeEach(() => {
  setRevealStepAction.mockReset().mockResolvedValue({ ok: true })
})

const row = (plateId: number, number: number, position: number, score: number, authors: string[]) => ({
  plateId, number, label: null, authors, position, score, avgRank: position, votes: 3, bestRank: 1, worstRank: 3, firsts: 0,
})

const view = (revealStep: number): AdminView => ({
  contest: { id: 1, name: 'Anniv', secret: 's', phase: 'reveal', revealStep },
  guests: [], plates: [],
  rows: [row(10, 1, 1, 80, ['Julie']), row(20, 2, 2, 60, ['Marc'])],
  steps: [
    { kind: 'title' },
    { kind: 'plate', plateIds: [20], position: 2, showAuthors: false, podium: true },
    { kind: 'plate', plateIds: [20], position: 2, showAuthors: true, podium: true },
    { kind: 'plate', plateIds: [10], position: 1, showAuthors: false, podium: true },
    { kind: 'plate', plateIds: [10], position: 1, showAuthors: true, podium: true },
    { kind: 'final' },
  ],
  complete: 0,
})

test('étape « note » : numéro et note, sans auteur', () => {
  render(<Scene initial={view(3)} />)
  expect(screen.getByText('80')).toBeTruthy()
  expect(screen.queryByText(/Julie/)).toBeNull()
  expect(screen.getByText(/\+20/)).toBeTruthy()
})

test('étape « auteurs » : le nom apparaît', () => {
  render(<Scene initial={view(4)} />)
  expect(screen.getByText(/Julie/)).toBeTruthy()
})

test('hors phase reveal : écran d’attente', () => {
  const v = view(0)
  render(<Scene initial={{ ...v, contest: { ...v.contest, phase: 'closed' } }} />)
  expect(screen.getByText(/en attente/i)).toBeTruthy()
})

test('touche maintenue (repeat) : l’étape n’est pas renvoyée', () => {
  render(<Scene initial={view(3)} />)
  fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
  expect(setRevealStepAction).not.toHaveBeenCalled()
})
