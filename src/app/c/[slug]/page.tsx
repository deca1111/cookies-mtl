import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CookieMap } from '@/components/CookieMap'
import { getShopBySlug, listShops } from '@/lib/shops'
import { SITE_NAME, shopTitle } from '@/lib/site'

export async function generateMetadata({ params }: PageProps<'/c/[slug]'>) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  if (!shop) return { title: SITE_NAME }
  return {
    title: shopTitle(shop.name),
    description: `${String(shop.rating).replace('.', ',')} / 5 · ${shop.review.slice(0, 140)}`,
  }
}

export default function ShopPage({ params }: PageProps<'/c/[slug]'>) {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[color:var(--bg)]" />}>
      <MapForShop params={params} />
    </Suspense>
  )
}

async function MapForShop({ params }: { params: PageProps<'/c/[slug]'>['params'] }) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  if (!shop) notFound()
  const shops = await listShops()
  return <CookieMap shops={shops} initialSlug={slug} />
}
