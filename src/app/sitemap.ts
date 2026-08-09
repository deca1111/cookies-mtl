import type { MetadataRoute } from 'next'
import { listShops } from '@/lib/shops'
import { SITE_URL } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
