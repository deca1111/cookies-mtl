import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { PlateLabels } from '../PlateLabels'

afterEach(cleanup)

const plates = (n: number) => Array.from({ length: n }, (_, i) => ({ number: n - i }))

test('une étiquette par assiette, dans l’ordre des numéros, 9 par page', () => {
  render(<PlateLabels contestName="Anniv" plates={plates(11)} />)
  const pages = screen.getAllByTestId('label-page')
  expect(pages).toHaveLength(2)
  expect(pages[0].querySelectorAll('[data-testid="label"]')).toHaveLength(9)
  expect(pages[1].querySelectorAll('[data-testid="label"]')).toHaveLength(2)
  expect(screen.getAllByTestId('label').map((l) => l.textContent)).toEqual(Array.from({ length: 11 }, (_, i) => `N° ${i + 1}`))
})

test('bouton imprimer : ouvre la boîte d’impression du navigateur', () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  render(<PlateLabels contestName="Anniv" plates={plates(3)} />)
  fireEvent.click(screen.getByRole('button', { name: /Imprimer/ }))
  expect(print).toHaveBeenCalled()
})

test('aucune assiette : message plutôt qu’une page blanche', () => {
  render(<PlateLabels contestName="Anniv" plates={[]} />)
  expect(screen.queryByTestId('label-page')).toBeNull()
  expect(screen.getByText(/Aucune assiette/)).toBeTruthy()
})

test('nombre forcé : numéros 1 à N, quel que soit le nombre d’assiettes, et retour aux assiettes', () => {
  render(<PlateLabels contestName="Anniv" plates={plates(3)} />)
  const field = screen.getByLabelText(/Nombre d’étiquettes/) as HTMLInputElement
  expect(field.value).toBe('3')
  fireEvent.change(field, { target: { value: '12' } })
  expect(screen.getAllByTestId('label').map((l) => l.textContent)).toEqual(Array.from({ length: 12 }, (_, i) => `N° ${i + 1}`))
  expect(screen.getAllByTestId('label-page')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: /Revenir aux assiettes/ }))
  expect(screen.getAllByTestId('label')).toHaveLength(3)
  expect(field.value).toBe('3')
})

test('nombre forcé sans assiette saisie, borné à 200, champ vidé sans planter', () => {
  render(<PlateLabels contestName="Anniv" plates={[]} />)
  const field = screen.getByLabelText(/Nombre d’étiquettes/)
  fireEvent.change(field, { target: { value: '5' } })
  expect(screen.getAllByTestId('label')).toHaveLength(5)
  fireEvent.change(field, { target: { value: '999' } })
  expect(screen.getAllByTestId('label')).toHaveLength(200)
  fireEvent.change(field, { target: { value: '' } })
  expect(screen.queryByTestId('label-page')).toBeNull()
  expect(screen.getByText(/au moins une étiquette/)).toBeTruthy()
})
