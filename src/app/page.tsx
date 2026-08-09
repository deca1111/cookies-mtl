import { Suspense } from 'react'
import { CookieMap } from '@/components/CookieMap'
import { homeJsonLd, jsonLdString } from '@/lib/jsonld'
import { listShops } from '@/lib/shops'

export default function Home() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[color:var(--bg)]" />}>
      <MapWithShops />
    </Suspense>
  )
}

async function MapWithShops() {
  const shops = await listShops()
  return (
    <>
      <CookieMap shops={shops} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd(shops)) }} />
    </>
  )
}
