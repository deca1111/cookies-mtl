// scripts/render-tiles.mjs — génère la pyramide raster des deux thèmes depuis le
// style de prod épuré, et (avec --upload) la pousse sur Vercel Blob.
//
// Usage :  node scripts/render-tiles.mjs [--themes=light,dark] [--zooms=11-16] [--upload]
// Prérequis : Google Chrome installé ; pour --upload, BLOB_READ_WRITE_TOKEN dans
// l'environnement (vercel env pull .env.local puis charger la variable).
// À relancer uniquement quand la palette, le filtre de couches ou le fond OSM
// changent — bumper alors PATH_VERSION pour invalider le CDN et mettre à jour
// NEXT_PUBLIC_TILES_BASE_URL si le store change.
//
// Pièges maplibre-gl 6.x (appris sur la démo du 2026-08-08) : ESM-only sans export
// default (`import * as`) ; preserveDrawingBuffer DOIT passer par
// canvasContextAttributes (sinon canvas transparent) ; le worker est résolu via
// import.meta.url, donc tous les fichiers dist doivent être servis depuis le même
// dossier HTTP.
import { createServer } from 'node:http'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, '.tiles-work')
const OUT = join(ROOT, '.tiles-out')
const PATH_VERSION = 'v1'
const BBOX = { west: -73.75, east: -73.45, south: 45.4, north: 45.62 }
// Dalles de 8x8 tuiles (2048 px) : les étiquettes ne peuvent se couper qu'aux
// jointures de dalles, pas à chaque tuile.
const SLAB = 8
const WEBP_QUALITY = 80

const args = new Map(process.argv.slice(2).map((a) => a.split('=')))
const THEMES = (args.get('--themes') ?? 'light,dark').split(',')
const [zMin, zMax] = (args.get('--zooms') ?? '11-16').split('-').map(Number)
const ZOOMS = Array.from({ length: zMax - zMin + 1 }, (_, i) => zMin + i)
const UPLOAD = args.has('--upload')

// -- même formule que src/lib/tile-math.ts (copie assumée : script Node pur) --
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// 1. bundle du vrai code de style (source unique de vérité — buildMapStyle)
mkdirSync(WORK, { recursive: true })
await build({
  entryPoints: [join(ROOT, 'src/lib/map-style.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'CmtlMapStyle',
  outfile: join(WORK, 'map-style.iife.js'),
  define: {
    'process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT': JSON.stringify(process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT ?? ''),
    'process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK': JSON.stringify(process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK ?? ''),
  },
})

// 2. fichiers maplibre servis localement (même version exacte que la prod)
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  copyFileSync(join(ROOT, 'node_modules/maplibre-gl/dist', f), join(WORK, f))
}

// 3. page de rendu
writeFileSync(
  join(WORK, 'render.html'),
  `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="maplibre-gl.css">
<style>body{margin:0}#map{width:${SLAB * 256}px;height:${SLAB * 256}px}</style>
</head><body><div id="map"></div>
<script src="map-style.iife.js"></script>
<script type="module">
import * as maplibregl from './maplibre-gl.mjs'
const THEME = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'
let mapReady = (async () => {
  const res = await fetch(CmtlMapStyle.getMapStyleUrl(THEME))
  if (!res.ok) throw new Error('style fetch failed: ' + res.status)
  const style = CmtlMapStyle.buildMapStyle(await res.json(), THEME)
  const map = new maplibregl.Map({
    container: 'map', style, center: [-73.5674, 45.5019], zoom: 11,
    pixelRatio: 1, fadeDuration: 0, attributionControl: false, interactive: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  })
  map.on('error', (e) => { window.__tileErrors = (window.__tileErrors || 0) + 1; console.error('map error', e?.error?.message) })
  await new Promise((ok) => map.once('idle', ok))
  return map
})()
window.renderSlab = async (lng, lat, z) => {
  const map = await mapReady
  map.jumpTo({ center: [lng, lat], zoom: z, bearing: 0, pitch: 0 })
  await new Promise((ok) => map.once('idle', ok))
  await new Promise((ok) => setTimeout(ok, 300))
  return map.getCanvas().toDataURL('image/png')
}
</script></body></html>`
)

// 4. mini serveur statique pour WORK (la résolution du worker exige du HTTP)
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  try {
    const file = join(WORK, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'render.html')
    const data = readFileSync(file) // lire AVANT writeHead : un échec doit pouvoir répondre 404
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    if (!res.headersSent) res.writeHead(404)
    res.end()
  }
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const port = server.address().port

// 5. rendu + découpe
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: SLAB * 256 + 100, height: SLAB * 256 + 100 } })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[page]', m.text())
})
let total = 0
for (const theme of THEMES) {
  await page.goto(`http://127.0.0.1:${port}/render.html?theme=${theme}`)
  await page.waitForFunction('typeof window.renderSlab === "function"')
  console.log(`=== thème ${theme} ===`)
  for (const z of ZOOMS) {
    const x0 = Math.floor(lon2x(BBOX.west, z))
    const x1 = Math.floor(lon2x(BBOX.east, z))
    const y0 = Math.floor(lat2y(BBOX.north, z))
    const y1 = Math.floor(lat2y(BBOX.south, z))
    for (let sx = x0; sx <= x1; sx += SLAB) {
      for (let sy = y0; sy <= y1; sy += SLAB) {
        const dataUrl = await page.evaluate(
          ([lng, lat, mz]) => window.renderSlab(lng, lat, mz),
          // zoom MapLibre = zoom Leaflet − 1 (tuiles 512 px vs 256 px)
          [x2lon(sx + SLAB / 2, z), y2lat(sy + SLAB / 2, z), z - 1]
        )
        const slab = sharp(Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'))
        for (let i = 0; i < SLAB; i++) {
          for (let j = 0; j < SLAB; j++) {
            const tx = sx + i
            const ty = sy + j
            if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue
            const file = join(OUT, 'tiles', PATH_VERSION, theme, String(z), String(tx), `${ty}.webp`)
            mkdirSync(dirname(file), { recursive: true })
            writeFileSync(
              file,
              await slab
                .clone()
                .extract({ left: i * 256, top: j * 256, width: 256, height: 256 })
                .webp({ quality: WEBP_QUALITY })
                .toBuffer()
            )
            total++
          }
        }
      }
    }
    console.log(`  ${theme} z${z} ok — ${total} tuiles cumulées`)
  }
}
const errors = await page.evaluate('window.__tileErrors || 0')
await browser.close()
server.close()
console.log(`RENDU TERMINÉ: ${total} tuiles, ${errors} erreurs de rendu`)
if (errors > 0) process.exit(1)

// 6. upload Blob (optionnel)
if (UPLOAD) {
  const { put } = await import('@vercel/blob')
  const { readdirSync, statSync } = await import('node:fs')
  const files = []
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else files.push(p)
    }
  }
  walk(join(OUT, 'tiles'))
  console.log(`upload de ${files.length} tuiles vers Vercel Blob…`)
  let uploaded = 0
  const CONCURRENCY = 12
  const queue = [...files]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const pathname = f.slice(OUT.length + 1).replaceAll('\\', '/')
        await put(pathname, readFileSync(f), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 31536000, // chemins stables versionnés par PATH_VERSION
          contentType: 'image/webp',
        })
        uploaded++
        if (uploaded % 500 === 0) console.log(`  ${uploaded}/${files.length}`)
      }
    })
  )
  console.log(`UPLOAD TERMINÉ: ${uploaded} tuiles`)
}
