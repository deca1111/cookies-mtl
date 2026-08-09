import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { SITE_BRAND } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Cookies Club — Montréal'

export default async function Image() {
  const gill = await readFile(join(process.cwd(), 'src/fonts/gill-sans-ultra-bold.otf'))
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
        <div style={{ fontSize: 110, color: '#502712' }}>{SITE_BRAND}</div>
        <div style={{ fontSize: 44, color: '#a4794a', marginTop: 10 }}>Montréal</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 42 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 56, height: 56, borderRadius: 28, background: '#d0914a', border: '6px solid #502712', display: 'flex' }} />
          ))}
        </div>
        <div style={{ fontSize: 28, color: '#7d6d5b', marginTop: 40 }}>La carte des cookies · Montreal&apos;s cookie map</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Gill Sans Ultra', data: gill, weight: 700, style: 'normal' }] }
  )
}
