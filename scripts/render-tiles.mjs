// scripts/render-tiles.mjs — génère la pyramide raster des deux thèmes depuis le
// style de prod épuré, directement dans public/tiles/ (committée avec le code,
// servie par le CDN Vercel comme asset statique — zéro service externe).
//
// Usage :  node scripts/render-tiles.mjs [--themes=light,dark] [--zooms=11-16]
// Prérequis : Google Chrome installé.
// À relancer uniquement quand la palette, le filtre de couches ou le fond OSM
// changent — bumper alors PATH_VERSION (ici ET dans src/lib/tile-math.ts +
// src/components/RasterMap.tsx) pour invalider les caches, puis committer les
// tuiles régénérées.
//
// Pourquoi pas Vercel Blob : une pyramide = ~10 000 fichiers, et Blob n'a pas
// d'upload groupé — une opération facturable par tuile a explosé le quota gratuit
// d'opérations dès le premier upload (store suspendu, 2026-08-08).
//
// Pièges maplibre-gl 6.x (appris sur la démo du 2026-08-08) : ESM-only sans export
// default (`import * as`) ; preserveDrawingBuffer DOIT passer par
// canvasContextAttributes (sinon canvas transparent) ; le worker est résolu via
// import.meta.url, donc tous les fichiers dist doivent être servis depuis le même
// dossier HTTP.
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, '.tiles-work')
const OUT = join(ROOT, 'public')
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
// --only-missing : ne rend que les tuiles absentes du disque (extension de marge,
// reprise). Ne PAS l'utiliser après un changement de style — les tuiles existantes
// seraient conservées telles quelles, donc périmées.
const ONLY_MISSING = args.has('--only-missing')

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
    // Marge de DEUX tuiles à chaque bord : au-delà de l'intersection stricte avec
    // la bbox (option `bounds`), Leaflet demande encore une rangée supplémentaire
    // (tampon keepBuffer + viewports transitoires des animations de zoom et de
    // l'élasticité maxBounds) — constaté en preview avec une marge de 1 (404 sur
    // y±2 du floor-range à z12).
    const MARGIN = 2
    const x0 = Math.floor(lon2x(BBOX.west, z)) - MARGIN
    const x1 = Math.floor(lon2x(BBOX.east, z)) + MARGIN
    const y0 = Math.floor(lat2y(BBOX.north, z)) - MARGIN
    const y1 = Math.floor(lat2y(BBOX.south, z)) + MARGIN
    for (let sx = x0; sx <= x1; sx += SLAB) {
      for (let sy = y0; sy <= y1; sy += SLAB) {
        if (ONLY_MISSING) {
          // saute la dalle entière si toutes ses tuiles dans la zone existent déjà
          let anyMissing = false
          for (let i = 0; i < SLAB && !anyMissing; i++) {
            for (let j = 0; j < SLAB && !anyMissing; j++) {
              const tx = sx + i
              const ty = sy + j
              if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue
              if (!existsSync(join(OUT, 'tiles', PATH_VERSION, theme, String(z), String(tx), `${ty}.webp`))) anyMissing = true
            }
          }
          if (!anyMissing) continue
        }
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
            if (ONLY_MISSING && existsSync(file)) continue
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
console.log(`RENDU TERMINÉ: ${total} tuiles écrites dans public/tiles, ${errors} erreurs de rendu`)
if (errors > 0) process.exit(1)
console.log('Penser à committer public/tiles avec le changement de style correspondant.')
