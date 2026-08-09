import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getShopBySlug } from '@/lib/shops'
import { SITE_NAME, SITE_BRAND } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  const name = shop?.name ?? SITE_NAME
  const rating = shop?.rating
  const gill = await readFile(join(process.cwd(), 'src/fonts/gill-sans-ultra-bold.otf'))
  const full = rating !== undefined ? Math.floor(rating) : 0

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
          fontFamily: 'Gill Sans Ultra',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, color: '#a4794a' }}>
          {SITE_BRAND} · Montréal
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 84,
            color: '#502712',
            marginTop: 24,
            textAlign: 'center',
            padding: '0 60px',
          }}
        >
          {name}
        </div>
        {rating !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16, marginTop: 36 }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const background =
                  i < full
                    ? '#d0914a'
                    : i === full && rating % 1 >= 0.5
                      ? 'linear-gradient(90deg, #d0914a 50%, #f3ede3 50%)'
                      : '#f3ede3'
                return (
                  <div
                    key={i}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background,
                      border: '5px solid #502712',
                      display: 'flex',
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', fontSize: 36, color: '#7d6d5b', marginTop: 24 }}>
              {String(rating).replace('.', ',')} / 5
            </div>
          </div>
        )}
      </div>
    ),
    { ...size, fonts: [{ name: 'Gill Sans Ultra', data: gill, weight: 700, style: 'normal' }] }
  )
}
