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
  expect(await screen.findByText('Votes clos')).toBeTruthy()
})

test('réclamation refusée (nom déjà pris) : bandeau et bouton de confirmation réutilisable', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  claimNameAction.mockResolvedValue({ ok: false, error: 'taken' })
  render(<ContestGuestApp secret="s" initial={base} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Julie' }))
  fireEvent.click(screen.getByRole('button', { name: 'C’est moi' }))
  expect(await screen.findByText('Ce nom vient d’être pris sur un autre téléphone.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'C’est moi' }).hasAttribute('disabled')).toBe(false)
})

test('réclamation en échec (réseau) : bandeau et bouton jamais bloqué', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  claimNameAction.mockRejectedValue(new Error('hors ligne'))
  render(<ContestGuestApp secret="s" initial={base} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Julie' }))
  fireEvent.click(screen.getByRole('button', { name: 'C’est moi' }))
  expect(await screen.findByText('Connexion impossible, réessaie.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'C’est moi' }).hasAttribute('disabled')).toBe(false)
})

// Finding #3 : un bulletin « invalid » (course avec l'admin) ne doit plus laisser
// le bandeau « nouvel essai en cours » sans rien en cours — il retente vraiment,
// avec les assiettes relues, ou repart du bulletin serveur si ça échoue encore.
test('bulletin refusé (invalid) : nouvel essai automatique, jamais le bandeau sans rien en cours', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  const withMe: GuestView = { ...base, me: { id: 1, name: 'Julie' } }
  const refreshed: GuestView = { ...withMe, plates: [{ id: 10, number: 1, label: null }], myBallot: [] }
  saveBallotAction.mockResolvedValueOnce({ ok: false, error: 'invalid' }).mockResolvedValueOnce({ ok: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(refreshed))))

  render(<ContestGuestApp secret="s" initial={withMe} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Assiette 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Placer ici' }))

  await waitFor(() => expect(saveBallotAction).toHaveBeenCalledTimes(2))
  expect(saveBallotAction).toHaveBeenNthCalledWith(1, 's', [10])
  expect(saveBallotAction).toHaveBeenNthCalledWith(2, 's', [10])
  await waitFor(() => expect(screen.queryByText('Enregistrement impossible, nouvel essai en cours…')).toBeNull())
})

test('bulletin refusé (invalid), nouvel essai aussi refusé : le classement repart du bulletin serveur', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  const withMe: GuestView = { ...base, me: { id: 1, name: 'Julie' } }
  const refreshed: GuestView = { ...withMe, plates: [{ id: 10, number: 1, label: null }], myBallot: [] }
  saveBallotAction.mockResolvedValueOnce({ ok: false, error: 'invalid' }).mockResolvedValueOnce({ ok: false, error: 'invalid' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(refreshed))))

  render(<ContestGuestApp secret="s" initial={withMe} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Assiette 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Placer ici' }))

  await waitFor(() => expect(saveBallotAction).toHaveBeenCalledTimes(2))
  // Le classement local repart du bulletin serveur (vide) : l'assiette redevient
  // disponible « à goûter » plutôt que de rester classée à tort.
  expect(await screen.findByRole('button', { name: 'Assiette 1' })).toBeTruthy()
  expect(screen.queryByText('Enregistrement impossible, nouvel essai en cours…')).toBeNull()
})
