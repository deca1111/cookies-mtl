import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { buildRevealSteps } from '@/lib/contest-reveal'
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
  expect(screen.getByText('80/100')).toBeTruthy()
  expect(screen.queryByText(/Julie/)).toBeNull()
})

// Retours d'UAT : ni rang moyen ni écart de points sur les slides, la note suffit.
test('slides sans détails : ni rang moyen, ni « pts devant »', () => {
  render(<Scene initial={view(4)} />)
  expect(screen.queryByText(/rang moyen|avg\. rank/)).toBeNull()
  expect(screen.queryByText(/pts devant|pts ahead/)).toBeNull()
})

test('étape « auteurs » : le nom apparaît', () => {
  render(<Scene initial={view(4)} />)
  expect(screen.getByText(/Julie/)).toBeTruthy()
})

// Écran final : les prénoms d'abord, le numéro d'assiette en second.
test('écran final : prénoms en grand, numéro d’assiette en petit', () => {
  const v = view(5)
  const rows = [...v.rows, row(30, 3, 3, 40, ['Léa']), row(40, 4, 4, 20, ['Hugo'])]
  render(<Scene initial={{ ...v, rows }} />)
  const rest = screen.getByTestId('final-rest')
  const name = Number.parseInt(within(rest).getByText('Hugo').className.match(/text-\[(\d+)px\]/)![1])
  const tag = Number.parseInt(within(rest).getByText('N° 4').className.match(/text-\[(\d+)px\]/)![1])
  expect(name).toBeGreaterThan(tag)
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

// L'étape optimiste (locale) ne doit pas rester affichée quand le serveur la
// refuse : sans le correctif, `localStep` restait bloqué sur l'étape jamais
// atteinte côté serveur et l'affichage aurait montré « auteurs » à tort.
test('étape refusée par le serveur : l’affichage reste sur l’étape en cours', async () => {
  setRevealStepAction.mockResolvedValue({ ok: false, error: 'locked' })
  render(<Scene initial={view(3)} />)
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  await waitFor(() => expect(setRevealStepAction).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByText(/Julie/)).toBeNull())
  expect(screen.getByText('80/100')).toBeTruthy()
})

// Fabrique à 4 assiettes (positions 1..4), étapes calculées comme en production :
// [title, 4e ?, 4e auteurs, 3e ?, 3e auteurs, duel, verdict, auteurs du duel, final].
const rows4 = [
  row(10, 1, 1, 90, ['Inès']),
  row(20, 2, 2, 70, ['Camille', 'Hugo']),
  row(30, 3, 3, 50, ['Léo']),
  row(40, 4, 4, 30, ['Zoé']),
]
const steps4 = buildRevealSteps(rows4)
const LAST = steps4.length - 1
const viewAt = (phase: AdminView['contest']['phase'], revealStep: number): AdminView => ({
  contest: { id: 1, name: 'Anniv', secret: 's', phase, revealStep },
  guests: [], plates: [], rows: rows4, steps: steps4, complete: 0,
})
const stepOf = (position: number, showAuthors: boolean) =>
  steps4.findIndex((s) => s.kind === 'plate' && s.position === position && s.showAuthors === showAuthors)

test('scène bilingue : titre FR et EN', async () => {
  render(<Scene initial={viewAt('reveal', 0)} />)
  expect(await screen.findByText('Le verdict')).toBeTruthy()
  expect(screen.getByText('The verdict')).toBeTruthy()
  expect(screen.getByText('0 bulletins · 4 assiettes')).toBeTruthy()
  expect(screen.getByText('0 ballots · 4 plates')).toBeTruthy()
})

test('3e, premier temps : médaille, auteurs masqués ; second temps : auteurs', async () => {
  render(<Scene initial={viewAt('reveal', stepOf(3, false))} />)
  expect(await screen.findByText('Auteurs à venir')).toBeTruthy()
  expect(screen.queryByText('Léo')).toBeNull()
  // Le rang est écrit sur la médaille (SVG), l'anglais dessous.
  expect(screen.getByText('3e').closest('svg')).toBeTruthy()
  expect(screen.getByText('3rd')).toBeTruthy()
  expect(screen.getByText('fait par')).toBeTruthy()
  expect(screen.getByText('baked by')).toBeTruthy()
  cleanup()
  render(<Scene initial={viewAt('reveal', stepOf(3, true))} />)
  expect(await screen.findByText('Léo')).toBeTruthy()
  expect(screen.queryByText('Auteurs à venir')).toBeNull()
})

const duelAt = (stage: string) => steps4.findIndex((s) => s.kind === 'duel' && s.stage === stage)

// Le 1er ne se devine plus par élimination : les deux finalistes arrivent
// ensemble, sans note ni médaille ni auteurs.
test('duel, intro : les deux finalistes, rien qui trahisse le gagnant', async () => {
  render(<Scene initial={viewAt('reveal', duelAt('intro'))} />)
  expect(await screen.findByText('Il en reste deux…')).toBeTruthy()
  expect(screen.getByText('Two left…')).toBeTruthy()
  expect(screen.getAllByTestId('finalist').map((f) => f.textContent)).toEqual([expect.stringContaining('N° 1'), expect.stringContaining('N° 2')])
  expect(screen.queryByText('90/100')).toBeNull()
  expect(screen.queryByText('1er')).toBeNull()
  expect(screen.queryByText('Inès')).toBeNull()
})

test('duel, verdict : médailles et notes, gagnant soulevé ; puis les auteurs', async () => {
  render(<Scene initial={viewAt('reveal', duelAt('result'))} />)
  expect(await screen.findByText('Le cookie de la soirée')).toBeTruthy()
  const [first, second] = screen.getAllByTestId('finalist')
  expect(first.textContent).toContain('1er')
  expect(first.textContent).toContain('90/100')
  expect(first.querySelector('.rv-win')).toBeTruthy()
  expect(second.textContent).toContain('2e')
  expect(second.querySelector('.rv-lose')).toBeTruthy()
  expect(screen.queryByText('Inès')).toBeNull()
  cleanup()
  render(<Scene initial={viewAt('reveal', duelAt('authors'))} />)
  expect(await screen.findByText('Inès')).toBeTruthy()
  expect(screen.getByText('Camille & Hugo')).toBeTruthy()
})

// Rangs du bas nombreux : un tableau qui se remplit par le bas, le meilleur en haut.
test('rangs du bas groupés : un tableau, meilleur en haut', async () => {
  const many = [...rows4, row(50, 5, 5, 20, ['Max']), row(60, 6, 6, 10, ['Ana']), row(70, 7, 7, 5, ['Tom'])]
  const steps = buildRevealSteps(many)
  render(<Scene initial={{ ...viewAt('reveal', 1), rows: many, steps }} />)
  expect(await screen.findByText('Du 7e au 4e')).toBeTruthy()
  expect(screen.getByText('7th to 4th')).toBeTruthy()
  const lines = [...screen.getByTestId('board').querySelectorAll('li')].map((li) => li.textContent)
  expect(lines[0]).toContain('Zoé')
  expect(lines.at(-1)).toContain('Tom')
})

test('écran final : pyramide puis liste', async () => {
  render(<Scene initial={viewAt('reveal', LAST)} />)
  const steps = await screen.findAllByTestId('podium-step')
  expect(steps.map((s) => s.dataset.position)).toEqual(['2', '1', '3'])
  expect(screen.getByText('Classement final')).toBeTruthy()
  expect(screen.getByText('Final ranking')).toBeTruthy()
  // Le 4e n'est pas sur la pyramide : il vient dans la liste dessous.
  expect(screen.getByTestId('final-rest').textContent).toContain('Zoé')
})

test('attente : nom du concours et texte bilingue', () => {
  render(<Scene initial={viewAt('closed', 0)} />)
  expect(screen.getByText('Anniv')).toBeTruthy()
  expect(screen.getByText('En attente de la révélation…')).toBeTruthy()
  expect(screen.getByText('Waiting for the reveal…')).toBeTruthy()
})
