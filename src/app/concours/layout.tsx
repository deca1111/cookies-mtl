import type { Metadata } from 'next'

// Partie privée du site, atteinte par QR code (spec §5) : jamais indexée, même
// si une URL fuitait. Doublé par l'en-tête X-Robots-Tag de next.config.ts.
// `alternates`/`openGraph` explicitement à null : sans ça, ces champs non définis
// ici hériteraient tels quels du layout racine (canonical "/", image Open Graph
// du site) — chaque page concours se déclarerait alors canonique pour la home.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: null,
}

export default function ContestLayout({ children }: LayoutProps<'/concours'>) {
  return children
}
