import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { contestDict, fmt, type ContestMsgKey } from '@/lib/contest-i18n'
import type { ResultRow } from '@/lib/contest-state'
import { GuestResults } from '../GuestResults'
import { Podium } from '../Podium'

afterEach(cleanup)
const t = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
const row = (plateId: number, position: number | null, authors: string[] = []): ResultRow => ({
  plateId, number: plateId, label: null, authors, position, score: 90 - plateId,
  avgRank: 1.5, votes: 3, bestRank: 1, worstRank: 3, firsts: 1,
})

test('ordre visuel 2e, 1er, 3e avec auteurs', () => {
  render(<Podium rows={[row(1, 1, ['Inès']), row(2, 2, ['Camille', 'Hugo']), row(3, 3, ['Léo'])]} size="phone" text={t} lang="fr" />)
  const steps = screen.getAllByTestId('podium-step')
  expect(steps.map((s) => s.dataset.position)).toEqual(['2', '1', '3'])
  expect(steps[0].textContent).toContain('Camille & Hugo')
})

test('ex æquo en tête : deux étiquettes sur la marche 1, pas de marche 2', () => {
  render(<Podium rows={[row(1, 1), row(2, 1), row(3, 3)]} size="phone" text={t} lang="fr" />)
  const steps = screen.getAllByTestId('podium-step')
  expect(steps.map((s) => s.dataset.position)).toEqual(['1', '3'])
  expect(steps[0].textContent).toContain('N° 1')
  expect(steps[0].textContent).toContain('N° 2')
})

// Point 3 de la vague de correction : la scène est toujours bilingue (spec §6).
// `subLang="en"` doit ajouter l'ordinal anglais sous chaque rang de la pyramide.
test('subLang="en" : la marche 1 affiche aussi l’ordinal anglais', () => {
  render(<Podium rows={[row(1, 1, ['Inès']), row(2, 2, ['Camille']), row(3, 3, ['Léo'])]} size="tv" text={t} lang="fr" subLang="en" />)
  const steps = screen.getAllByTestId('podium-step')
  const first = steps.find((s) => s.dataset.position === '1')!
  expect(first.textContent).toContain('1er')
  expect(first.textContent).toContain('1st')
})

test('récapitulatif invité : pyramide puis le reste, rangs en ordinaux', () => {
  const rows = [row(1, 1, ['Inès']), row(2, 2), row(3, 3), row(4, 4, ['Zoé']), row(5, null)]
  render(<GuestResults results={{ rows, agreement: null, myPlates: [] }} myBallot={[]} t={t} lang="fr" />)
  expect(screen.getAllByTestId('podium-step').map((s) => s.dataset.position)).toEqual(['2', '1', '3'])
  const rest = screen.getAllByTestId('results-rest-row')
  expect(rest.map((r) => r.textContent)).toEqual([expect.stringContaining('4e'), expect.stringContaining('Non classée')])
  expect(rest[0].textContent).toContain('Zoé')
})
