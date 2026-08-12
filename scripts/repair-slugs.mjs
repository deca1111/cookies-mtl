// scripts/repair-slugs.mjs — réparation ponctuelle (spec 2026-08-11 §4).
//
// Deux dégâts laissés par les liens Google mal lus :
//  1. des slugs construits sur un nom qui contenait l'adresse. Corriger le nom
//     dans l'admin ne les touchait pas — updateShop ne recalculait pas le slug.
//  2. une adresse sans numéro civique là où le géocodage inverse n'avait rien
//     trouvé d'exploitable autour du point, alors que le lien Google la portait.
//
// Aperçu par défaut, écriture sur --write. Idempotent : relancé, il ne trouve
// plus rien à faire.
//
//   node scripts/repair-slugs.mjs            # aperçu
//   node scripts/repair-slugs.mjs --write    # applique
import { neon } from '@neondatabase/serverless'
import { buildSync } from 'esbuild'
import { readFileSync } from 'node:fs'

// La logique de slug et de lecture des liens vit en TypeScript, testée. On la
// compile à la volée plutôt que d'en recopier une variante ici : une réparation
// qui diverge du code de production répare de travers.
const bundle = buildSync({
  stdin: {
    contents: `
      export { nextSlug } from './src/lib/slug'
      export { extractGoogleListing } from './src/lib/google-link'
      export { hasStreetNumber } from './src/lib/address'
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { nextSlug, extractGoogleListing, hasStreetNumber } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)

const write = process.argv.includes('--write')

const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL missing from .env.local — run: vercel env pull .env.local --yes')
const sql = neon(line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, ''))

const shops = await sql`SELECT id, slug, name, address, google_maps_url, previous_slugs FROM shops ORDER BY id`

// Les slugs que la réparation ne doit pas piétiner : ceux en service et ceux
// déjà archivés par une fiche renommée.
const taken = new Set()
for (const s of shops) {
  taken.add(s.slug)
  for (const old of s.previous_slugs ?? []) taken.add(old)
}

const actions = []
for (const shop of shops) {
  const sansLui = new Set(taken)
  sansLui.delete(shop.slug)
  const slug = nextSlug(shop.slug, shop.name, sansLui)

  // L'adresse du lien ne remplace que ce qui ne situe rien : les libellés Photon
  // déjà corrects (avec numéro, en français) sont laissés tels quels.
  let address = null
  if (!hasStreetNumber(shop.address)) {
    const listing = extractGoogleListing(shop.google_maps_url)
    if (listing?.address && hasStreetNumber(listing.address)) address = listing.address
  }

  if (slug || address) actions.push({ shop, slug, address })
}

if (actions.length === 0) {
  console.log('Rien à réparer.')
  process.exit(0)
}

console.log(write ? 'ÉCRITURE\n' : 'APERÇU — relancer avec --write pour appliquer\n')
for (const { shop, slug, address } of actions) {
  console.log(`#${shop.id} ${shop.name}`)
  if (slug) console.log(`   slug    ${shop.slug}\n        →  ${slug}`)
  if (address) console.log(`   adresse "${shop.address}"\n        →  "${address}"`)
  console.log('')
}

if (!write) process.exit(0)

for (const { shop, slug, address } of actions) {
  if (slug && address) {
    await sql`
      UPDATE shops SET slug = ${slug}, previous_slugs = array_append(previous_slugs, ${shop.slug}),
        address = ${address}, updated_at = now() WHERE id = ${shop.id}
    `
  } else if (slug) {
    await sql`
      UPDATE shops SET slug = ${slug}, previous_slugs = array_append(previous_slugs, ${shop.slug}),
        updated_at = now() WHERE id = ${shop.id}
    `
  } else {
    await sql`UPDATE shops SET address = ${address}, updated_at = now() WHERE id = ${shop.id}`
  }
}

console.log(`${actions.length} fiche(s) réparée(s).`)
console.log('Les anciens slugs restent résolus par /c/[slug] — redirection permanente.')
