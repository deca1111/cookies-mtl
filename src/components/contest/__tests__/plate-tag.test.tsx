import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { PlateTag } from '../PlateTag'

afterEach(cleanup)

test('affiche le numéro, et la note si fournie', () => {
  render(<PlateTag label="N° 3" size="lg" score={82} scoreLabel="82/100" />)
  expect(screen.getByText('N° 3')).toBeTruthy()
  expect(screen.getByText('82/100')).toBeTruthy()
})

test('sans note : pas de ligne de score', () => {
  const { container } = render(<PlateTag label="N° 3" size="sm" />)
  expect(container.textContent).toBe('N° 3')
})

// Retours d'UAT : « cookie N° X » se lit mieux qu'une icône d'assiette abstraite.
test('avec cookie : le cookie de marque à côté du numéro, dans l’étiquette', () => {
  const { container } = render(<PlateTag label="N° 3" size="sm" cookie />)
  expect(container.querySelector('use')?.getAttribute('href')).toBe('#cmtl-cookie-full')
  expect(container.textContent).toBe('N° 3')
})
