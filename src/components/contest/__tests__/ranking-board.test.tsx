import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { contestDict, fmt, type ContestMsgKey } from '@/lib/contest-i18n'
import { RankingBoard } from '../RankingBoard'

// Pas de nettoyage automatique ici (pas de `globals: true` dans vitest.config.mts) :
// sans ce nettoyage explicite, le DOM d'un test précédent reste monté et fausse
// les requêtes getByRole/getAllByRole du test suivant (même convention que les
// autres suites de composants, ex. admin-sort.test.tsx).
afterEach(cleanup)

const t = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
const plates = [
  { id: 10, number: 1, label: null },
  { id: 20, number: 2, label: 'Noisette' },
  { id: 30, number: 3, label: null },
]

test('classement vide au départ, toutes les assiettes à goûter', () => {
  render(<RankingBoard plates={plates} ranking={[]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByText(contestDict.fr.emptyRanking)).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /Assiette \d/ })).toHaveLength(3)
})

test('les pastilles à goûter affichent l’étiquette « N° X », sous le nom accessible « Assiette N »', () => {
  render(<RankingBoard plates={plates} ranking={[]} onChange={vi.fn()} locked={false} t={t} />)
  const btn = screen.getByRole('button', { name: 'Assiette 2' })
  expect(btn.textContent).toBe('N° 2')
})

test('une ligne classée : « N° X » et sa note, sans le texte « Assiette X » en double', () => {
  render(<RankingBoard plates={plates} ranking={[20]} onChange={vi.fn()} locked={false} t={t} />)
  const row = screen.getByRole('listitem')
  expect(row.textContent).toContain('N° 2')
  expect(row.textContent).toContain('Noisette')
  expect(row.textContent).not.toContain('Assiette')
})

test('toucher une assiette puis « Placer ici » l’insère à cet endroit', () => {
  const onChange = vi.fn()
  render(<RankingBoard plates={plates} ranking={[10, 30]} onChange={onChange} locked={false} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'Assiette 2' }))
  const slots = screen.getAllByRole('button', { name: 'Placer ici' })
  expect(slots).toHaveLength(3)
  fireEvent.click(slots[1])
  expect(onChange).toHaveBeenCalledWith([10, 20, 30])
})

test('assiette choisie puis supprimée par l’admin : le classement ignore l’ancien choix', () => {
  const onChange = vi.fn()
  const { rerender } = render(<RankingBoard plates={plates} ranking={[10, 30]} onChange={onChange} locked={false} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'Assiette 2' }))
  // L'admin supprime l'assiette 2 (id 20) pendant que l'invité l'avait en main.
  rerender(<RankingBoard plates={plates.filter((p) => p.id !== 20)} ranking={[10, 30]} onChange={onChange} locked={false} t={t} />)
  const slots = screen.queryAllByRole('button', { name: 'Placer ici' })
  expect(slots).toHaveLength(0)
  for (const s of slots) fireEvent.click(s)
  expect(onChange).not.toHaveBeenCalledWith([10, 20, 30])
})

test('monter, retirer', () => {
  const onChange = vi.fn()
  render(<RankingBoard plates={plates} ranking={[10, 30]} onChange={onChange} locked={false} t={t} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Monter' })[1])
  expect(onChange).toHaveBeenLastCalledWith([30, 10])
  fireEvent.click(screen.getAllByRole('button', { name: 'Retirer' })[0])
  expect(onChange).toHaveBeenLastCalledWith([30])
})

test('verrouillé : aucune commande', () => {
  render(<RankingBoard plates={plates} ranking={[10]} onChange={vi.fn()} locked t={t} />)
  expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Assiette 2/ })).toBeNull()
})

test('une assiette supprimée disparaît du classement affiché', () => {
  render(<RankingBoard plates={plates.slice(0, 2)} ranking={[30, 10]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.queryByText('N° 3')).toBeNull()
})

test('indicateur de progression', () => {
  const { rerender } = render(<RankingBoard plates={plates} ranking={[10]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByText('Encore 2 à goûter')).toBeTruthy()
  rerender(<RankingBoard plates={plates} ranking={[10, 20, 30]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByText(contestDict.fr.allRanked)).toBeTruthy()
})

// Glisser « classique » au doigt (retour d'UAT) : pastilles et poignées en
// `touch-none`, sinon le navigateur prend le geste pour un défilement et le
// glisser ne part pas sans appui long.
test('pastilles et poignées en touch-none : le glisser part tout de suite au doigt', () => {
  render(<RankingBoard plates={plates} ranking={[20]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByRole('button', { name: 'Assiette 1' }).className).toContain('touch-none')
  expect(screen.getByRole('button', { name: contestDict.fr.dragHandle }).className).toContain('touch-none')
})
