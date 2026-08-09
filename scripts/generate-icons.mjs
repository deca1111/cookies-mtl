// Régénère les icônes du site depuis public/brand/logo.svg :
//   src/app/favicon.ico (16/32/48), src/app/icon.png (512),
//   src/app/apple-icon.png (180, fond crème), public/icons/icon-{192,512}.png (manifest PWA).
// Usage : node scripts/generate-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

// Les lettres « COOKIES CLUB » en arc sont retirées : illisibles sous 48 px,
// seul le cookie illustré sert d'icône.
const svg = readFileSync('public/brand/logo.svg', 'utf8')
const noText = svg.replace(/<text[\s\S]*?<\/text>/g, '')

const big = await sharp(Buffer.from(noText), { density: 1000 }).png().toBuffer()
const trimmed = await sharp(big).trim().png().toBuffer()
const meta = await sharp(trimmed).metadata()

// Recadrage carré centré, marge transparente de 5 %
const side = Math.max(meta.width, meta.height)
const margin = Math.round(side * 0.05)
const canvas = side + margin * 2
const top = Math.round((canvas - meta.height) / 2)
const left = Math.round((canvas - meta.width) / 2)
const square = await sharp(trimmed)
  .extend({
    top,
    bottom: canvas - meta.height - top,
    left,
    right: canvas - meta.width - left,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer()

const png = (s) => sharp(square).resize(s, s).png()

mkdirSync('public/icons', { recursive: true })
await png(512).toFile('src/app/icon.png')
await png(512).toFile('public/icons/icon-512.png')
await png(192).toFile('public/icons/icon-192.png')

// apple-touch-icon : iOS remplit la transparence en noir → fond crème
// (#f3ede3 = background_color du manifest), cookie à ~82 % du cadre.
const APPLE = 180
const inner = Math.round(APPLE * 0.82)
const cookie = await sharp(square).resize(inner, inner).png().toBuffer()
await sharp({
  create: { width: APPLE, height: APPLE, channels: 4, background: '#f3ede3' },
})
  .composite([{ input: cookie, gravity: 'centre' }])
  .png()
  .toFile('src/app/apple-icon.png')

// favicon.ico : conteneur ICO à entrées PNG (16/32/48), format accepté
// par tous les navigateurs modernes.
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = 6 + 16 * entries.length
  entries.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.data)])
}

const icoEntries = []
for (const s of [16, 32, 48]) {
  icoEntries.push({ size: s, data: await png(s).toBuffer() })
}
writeFileSync('src/app/favicon.ico', buildIco(icoEntries))

console.log('Icônes régénérées depuis public/brand/logo.svg')
