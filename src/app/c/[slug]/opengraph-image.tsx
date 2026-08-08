import { ImageResponse } from 'next/og'
import { getShopBySlug } from '@/lib/shops'
import { SITE_NAME, SITE_BRAND } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  const name = shop?.name ?? SITE_NAME
  const rating = shop ? `${String(shop.rating).replace('.', ',')} / 5` : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3ede3',
          color: '#2c1f16',
        }}
      >
        <div style={{ fontSize: 40, color: '#a4794a' }}>🍪 {SITE_BRAND}</div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 24, textAlign: 'center', padding: '0 60px' }}>{name}</div>
        {rating && <div style={{ fontSize: 48, color: '#a4794a', marginTop: 24 }}>{rating}</div>}
      </div>
    ),
    size
  )
}
