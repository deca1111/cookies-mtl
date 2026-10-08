// Images PNG du QR (spec PR 2 §4), rendues par Satori : flexbox seulement,
// chaque <div> à plusieurs enfants doit déclarer `display: flex`.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'

const CHOCO = '#2c1f16'

async function qrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: CHOCO, light: '#0000' } })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

// Chemins littéraux (et non un helper `read(rel)` à chemin variable) : le
// traçage de fichiers de Vercel (@vercel/nft) analyse statiquement les appels
// `fs`/`readFile` et ne suit pas un chemin construit à l'exécution — sans ça,
// `public/brand/logo.svg` et les polices ne seraient pas inclus dans le bundle
// de la fonction en production (même forme que src/app/opengraph-image.tsx).
export async function qrCardImage({ url, name }: { url: string; name: string }): Promise<ImageResponse> {
  const [qr, logo, gill, comfortaa] = await Promise.all([
    qrDataUri(url),
    readFile(join(process.cwd(), 'public/brand/logo.svg')),
    readFile(join(process.cwd(), 'src/fonts/gill-sans-ultra-bold.otf')),
    readFile(join(process.cwd(), 'src/fonts/comfortaa-700.woff')),
  ])
  const logoUri = `data:image/svg+xml;base64,${logo.toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'transparent' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, background: '#fffdf9', border: '14px solid #d29a55', borderRadius: 48, margin: 0 }}>
          <img src={logoUri} width={400} height={400} alt="" style={{ margin: '-24px 0' }} />
          {/* Un nom long passe sur moins de lignes : sur trois, le logo agrandi pousserait le slogan hors de la carte. */}
          <div style={{ fontFamily: 'Gill Sans Ultra', fontSize: name.length > 24 ? 60 : 76, color: CHOCO, textAlign: 'center', maxWidth: 900 }}>{name}</div>
          <div style={{ display: 'flex', background: '#f6f0e6', borderRadius: 40, padding: 40 }}>
            <img src={qr} width={540} height={540} alt="" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Comfortaa', fontSize: 44 }}>
            <div style={{ color: CHOCO }}>Scanne, goûte, classe.</div>
            <div style={{ color: '#7d6d5b', fontSize: 38, marginTop: 8 }}>Scan, taste, rank.</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1440,
      fonts: [
        { name: 'Gill Sans Ultra', data: gill, weight: 700, style: 'normal' },
        { name: 'Comfortaa', data: comfortaa, weight: 700, style: 'normal' },
      ],
    },
  )
}

export async function qrOnlyImage({ url }: { url: string }): Promise<ImageResponse> {
  const qr = await qrDataUri(url)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffdf9' }}>
        <img src={qr} width={880} height={880} alt="" />
      </div>
    ),
    { width: 1024, height: 1024 },
  )
}
