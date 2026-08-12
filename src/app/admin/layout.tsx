import type { Metadata } from 'next'

// Ce layout n'existe que pour une ligne : remplacer, sur /admin seulement, le
// <link rel="manifest"> que le manifest racine fait poser par Next sur toutes les
// pages. Les métadonnées sont fusionnées de la racine vers la feuille et les clés
// en double sont écrasées par le segment le plus profond — c'est ce qui permet à
// l'admin d'annoncer sa propre PWA (start_url /admin) sans toucher à la publique.
export const metadata: Metadata = { manifest: '/admin/manifest.webmanifest' }

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return children
}
