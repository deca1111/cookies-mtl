import type { MetadataRoute } from 'next'
import { SITE_NAME, SITE_BRAND } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_BRAND,
    description: 'La carte des cookies de Montréal · Montreal cookie map',
    start_url: '/',
    display: 'standalone',
    // Splash PWA = fond de page clair (variante C taupe, retours couleurs v1.2.1).
    background_color: '#dcd2bf',
    // Chrome navigateur : espresso de la marque (indépendant du doré des boutons).
    theme_color: '#3b2a1f',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
