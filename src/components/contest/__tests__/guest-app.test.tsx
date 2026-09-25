import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { GuestView } from '@/lib/contest-state'

const claimNameAction = vi.fn()
const saveBallotAction = vi.fn()
vi.mock('@/app/actions/contest-guest', () => ({
  claimNameAction: (...a: unknown[]) => claimNameAction(...a),
  saveBallotAction: (...a: unknown[]) => saveBallotAction(...a),
}))

import { ContestGuestApp } from '../ContestGuestApp'

// Pas de nettoyage automatique (pas de `globals: true` dans vitest.config.mts) :
// même convention que les autres suites de composants (ex. admin-sort.test.tsx).
afterEach(cleanup)

const base: GuestView = {
  name: 'Anniv', phase: 'voting', final: false, me: null,
  guests: [{ id: 1, name: 'Julie', taken: false }, { id: 2, name: 'Marc', taken: true }],
  plates: [{ id: 10, number: 1, label: null }], myBallot: [], results: null,
}

beforeEach(() => {
  localStorage.clear()
  claimNameAction.mockReset().mockResolvedValue({ ok: true })
  saveBallotAction.mockReset().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(base))))
})

test('premier écran : choix de la langue, mémorisé', async () => {
  render(<ContestGuestApp secret="s" initial={base} />)
  fireEvent.click(await screen.findByRole('button', { name: 'English' }))
  expect(localStorage.getItem('cc_concours_lang')).toBe('en')
  expect(await screen.findByText('Who are you?')).toBeTruthy()
})

test('choix du nom : nom pris désactivé, confirmation puis action', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={base} />)
  expect((await screen.findByRole('button', { name: /Marc/ })).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Julie' }))
  fireEvent.click(screen.getByRole('button', { name: 'C’est moi' }))
  await waitFor(() => expect(claimNameAction).toHaveBeenCalledWith('s', 1))
})

test('identifié en phase de vote : le classement s’affiche', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, me: { id: 1, name: 'Julie' } }} />)
  expect(await screen.findByText('Mon classement')).toBeTruthy()
})

test('révélation en cours : rien n’est dévoilé', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, phase: 'reveal', me: { id: 1, name: 'Julie' } }} />)
  expect(await screen.findByText('Les yeux sur l’écran !')).toBeTruthy()
})
