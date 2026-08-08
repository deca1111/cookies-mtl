import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cookies MTL',
    short_name: 'Cookies MTL',
    description: 'La carte des cookies de Montréal',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3ede3',
    theme_color: '#3b2a1f',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  }
}
