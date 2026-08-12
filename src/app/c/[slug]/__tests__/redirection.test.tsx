import { expect, test, vi } from 'vitest'

// Une fiche renommée change d'URL (spec 2026-08-11 §3). L'ancienne doit répondre
// par une redirection permanente — c'est ce qui protège les liens déjà partagés
// et l'indexation Google — et non par un 404.
vi.mock('@/lib/shops', () => ({
  getShopBySlug: vi.fn(async () => null),
  getShopByPreviousSlug: vi.fn(async (slug: string) =>
    slug === 'ciao-amore-cafe-838-avenue-du-mont-royal-e-montreal-qc-h2j-1x1'
      ? { id: 1, slug: 'ciao-amore-cafe', name: 'Ciao Amore Café' }
      : null
  ),
  listShops: vi.fn(async () => []),
}))

const permanentRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND')
})
vi.mock('next/navigation', () => ({
  get permanentRedirect() {
    return permanentRedirect
  },
  get notFound() {
    return notFound
  },
}))

// La page rend une carte MapLibre : hors sujet ici, et coûteux en jsdom.
vi.mock('@/components/CookieMap', () => ({ CookieMap: () => null }))

type ElementAvecEnfant = {
  props: { children: { type: (props: unknown) => Promise<unknown>; props: unknown } }
}

async function rendreFiche(slug: string) {
  const page = await import('../page')
  const element = page.default({ params: Promise.resolve({ slug }) } as never)
  // Le composant est enveloppé dans un <Suspense> ; on invoque directement l'enfant
  // asynchrone, seul porteur de la décision redirection / 404.
  const enfant = (element as unknown as ElementAvecEnfant).props.children
  return enfant.type(enfant.props)
}

test('ancien slug → redirection permanente vers le slug courant', async () => {
  await expect(
    rendreFiche('ciao-amore-cafe-838-avenue-du-mont-royal-e-montreal-qc-h2j-1x1')
  ).rejects.toThrow('REDIRECT:/c/ciao-amore-cafe')
  expect(permanentRedirect).toHaveBeenCalledWith('/c/ciao-amore-cafe')
})

test('slug inconnu de partout → 404, pas de redirection', async () => {
  await expect(rendreFiche('jamais-vu')).rejects.toThrow('NOT_FOUND')
  expect(notFound).toHaveBeenCalled()
})
