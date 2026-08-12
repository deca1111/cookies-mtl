import type { MetadataRoute } from 'next'
import { SITE_BRAND } from './site'

// Manifest de la PWA d'administration, servi par
// `src/app/admin/manifest.webmanifest/route.ts` et déclaré par le layout d'/admin.
//
// Pourquoi un second manifest plutôt qu'un réglage dans celui de la racine :
// depuis iOS 16.4, « Sur l'écran d'accueil » ne retient plus l'URL affichée mais
// le `start_url` du manifest de la page. Comme `src/app/manifest.ts` (racine,
// injecté partout par Next) annonce '/', tout raccourci créé depuis /admin
// atterrissait sur la carte publique. Le champ `start_url` n'étant pas
// paramétrable par page, il faut un manifest distinct pour ce périmètre.
export function adminManifest(): MetadataRoute.Manifest {
  return {
    // `id` distinct de celui de la PWA publique : c'est lui qui sépare les deux
    // applications aux yeux du navigateur. Sans ça, même domaine + mêmes icônes,
    // et l'une remplace l'autre sur l'écran d'accueil.
    id: '/admin',
    name: `${SITE_BRAND} — Admin`,
    short_name: 'Admin',
    description: 'Ajout et édition des fiches cookies.',
    start_url: '/admin',
    // Périmètre volontairement fermé sur /admin : l'admin ne pointe vers aucune
    // page publique, donc rien à en faire sortir. Explicite plutôt que déduit du
    // dossier du manifest, pour que l'intention se lise ici.
    scope: '/admin',
    display: 'standalone',
    background_color: '#dcd2bf',
    theme_color: '#3b2a1f',
    // Mêmes icônes que la carte : c'est le même produit, vu de derrière.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
