import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { listShops } from '@/lib/shops'
import { SITE_URL } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Rendu à la requête OBLIGATOIRE (constaté en prod, 2026-08-10) : figé au build,
  // le sitemap gardait l'état de la DB du build — updateTag('shops') ne régénère
  // PAS cette route statique, contrairement à la home (PPR). Avec connection(),
  // il lit à chaque requête le même cache tagué frais que la carte. Coût nul :
  // seuls les robots consultent un sitemap.
  await connection()
  const shops = await listShops()
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    ...shops.map((s) => ({
      url: `${SITE_URL}/c/${s.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
