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
