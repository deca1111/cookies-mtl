import type { Metadata } from 'next'

// Partie privée du site, atteinte par QR code (spec §5) : jamais indexée, même
// si une URL fuitait. Doublé par l'en-tête X-Robots-Tag de next.config.ts.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function ContestLayout({ children }: LayoutProps<'/concours'>) {
  return children
}
