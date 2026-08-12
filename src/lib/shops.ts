import { cacheLife, cacheTag } from 'next/cache'
import { getSql } from './db'
import { nextSlug, uniqueSlug } from './slug'
import type { ShopInput } from './validate'

export type Shop = ShopInput & { id: number; slug: string; createdAt: string }

// Ce qui suffit à reconnaître un magasin déjà saisi (voir shop-duplicate.ts) :
// nom + position, et l'URL Google dont on extrait l'identifiant de lieu.
export type ShopIdentity = { id: number; name: string; lat: number; lng: number; googleMapsUrl: string }

type Row = {
  id: number; slug: string; name: string; address: string
  lat: number; lng: number; google_maps_url: string; rating: string; review: string
  in_progress: boolean; created_at: string | Date
}

function toShop(r: Row): Shop {
  return {
    id: r.id, slug: r.slug, name: r.name, address: r.address,
    lat: r.lat, lng: r.lng, googleMapsUrl: r.google_maps_url,
    rating: Number(r.rating), review: r.review,
    inProgress: r.in_progress,
    // Le pilote Neon rend un Date pour un timestamptz ; on normalise en ISO (UTC)
    // pour que la valeur traverse la frontière serveur → client sans surprise.
    createdAt: new Date(r.created_at).toISOString(),
  }
}

// Les fonctions publiques (celles au nom nu) excluent les fiches « en cours » en
// SQL : une nouvelle page qui appelle listShops/getShopBySlug est publique-sûre
// sans avoir à y penser. L'admin, lui, demande explicitement listAllShops.
export async function listShops(): Promise<Shop[]> {
  'use cache'
  cacheLife('max')
  cacheTag('shops')
  const sql = getSql()
  const rows = (await sql`SELECT * FROM shops WHERE in_progress = false ORDER BY rating DESC, name ASC`) as Row[]
  return rows.map(toShop)
}

export async function listAllShops(): Promise<Shop[]> {
  'use cache'
  cacheLife('max')
  cacheTag('shops')
  const sql = getSql()
  const rows = (await sql`SELECT * FROM shops ORDER BY rating DESC, name ASC`) as Row[]
  return rows.map(toShop)
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  'use cache'
  cacheLife('max')
  cacheTag('shops')
  const sql = getSql()
  const rows = (await sql`SELECT * FROM shops WHERE slug = ${slug} AND in_progress = false`) as Row[]
  return rows[0] ? toShop(rows[0]) : null
}

// Une fiche renommée a changé d'URL. Plutôt que de rendre 404 sur l'ancienne,
// /c/[slug] la retrouve ici et redirige en permanent vers l'URL courante.
export async function getShopByPreviousSlug(slug: string): Promise<Shop | null> {
  'use cache'
  cacheLife('max')
  cacheTag('shops')
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM shops WHERE ${slug} = ANY(previous_slugs) AND in_progress = false
  `) as Row[]
  return rows[0] ? toShop(rows[0]) : null
}

// Lecture délibérément NON cachée, et réduite aux colonnes de l'identité : le
// contrôle d'unicité doit voir la table telle qu'elle est à l'instant de
// l'écriture. Passer par listAllShops (`use cache`) laisserait un doublon entrer
// pendant la fenêtre où le cache est encore tiède.
export async function listShopIdentities(): Promise<ShopIdentity[]> {
  const sql = getSql()
  // Alias entre guillemets : sans eux Postgres replierait la casse et renverrait
  // `googlemapsurl`, que findDuplicate ne lirait jamais.
  return (await sql`SELECT id, name, lat, lng, google_maps_url AS "googleMapsUrl" FROM shops`) as ShopIdentity[]
}

// Tous les slugs qu'une nouvelle fiche ne doit pas prendre : ceux en service, et
// ceux qu'une fiche renommée a laissés derrière elle. Réutiliser un ancien slug
// détournerait sa redirection vers le mauvais magasin.
async function takenSlugs(sql: ReturnType<typeof getSql>, exceptId?: number): Promise<Set<string>> {
  const rows = (await sql`SELECT id, slug, previous_slugs FROM shops`) as {
    id: number
    slug: string
    previous_slugs: string[]
  }[]
  const taken = new Set<string>()
  for (const row of rows) {
    if (row.id === exceptId) continue
    taken.add(row.slug)
    for (const old of row.previous_slugs ?? []) taken.add(old)
  }
  return taken
}

export async function insertShop(input: ShopInput): Promise<Shop> {
  const sql = getSql()
  const slug = uniqueSlug(input.name, await takenSlugs(sql))
  const rows = (await sql`
    INSERT INTO shops (slug, name, address, lat, lng, google_maps_url, rating, review, in_progress)
    VALUES (${slug}, ${input.name}, ${input.address}, ${input.lat}, ${input.lng},
            ${input.googleMapsUrl}, ${input.rating}, ${input.review}, ${input.inProgress})
    RETURNING *
  `) as Row[]
  return toShop(rows[0])
}

// Le slug suit le nom (spec 2026-08-11 §3). Avant, il était figé à la création :
// corriger un nom mal extrait d'un lien Google laissait derrière lui une URL du
// genre /c/ciao-amore-cafe-838-avenue-du-mont-royal-e-montreal-qc-h2j-1x1.
//
// La fiche s'exclut du calcul d'unicité, sinon son propre slug la ferait glisser
// d'un cran à chaque enregistrement (« -2 », « -3 »…). L'ancien est archivé pour
// que /c/[slug] sache encore le résoudre.
export async function updateShop(id: number, input: ShopInput): Promise<void> {
  const sql = getSql()
  const current = (await sql`SELECT slug FROM shops WHERE id = ${id}`) as { slug: string }[]
  const slug = current[0] ? nextSlug(current[0].slug, input.name, await takenSlugs(sql, id)) : null

  if (slug && slug !== current[0].slug) {
    await sql`
      UPDATE shops SET slug = ${slug}, previous_slugs = array_append(previous_slugs, ${current[0].slug}),
        name = ${input.name}, address = ${input.address}, lat = ${input.lat},
        lng = ${input.lng}, google_maps_url = ${input.googleMapsUrl}, rating = ${input.rating},
        review = ${input.review}, in_progress = ${input.inProgress}, updated_at = now()
      WHERE id = ${id}
    `
    return
  }

  await sql`
    UPDATE shops SET name = ${input.name}, address = ${input.address}, lat = ${input.lat},
      lng = ${input.lng}, google_maps_url = ${input.googleMapsUrl}, rating = ${input.rating},
      review = ${input.review}, in_progress = ${input.inProgress}, updated_at = now()
    WHERE id = ${id}
  `
}

// Bascule seule, pour le bouton de la liste admin : pas de re-validation d'une
// fiche complète juste pour changer un booléen.
export async function setShopInProgress(id: number, inProgress: boolean): Promise<void> {
  const sql = getSql()
  await sql`UPDATE shops SET in_progress = ${inProgress}, updated_at = now() WHERE id = ${id}`
}

export async function deleteShop(id: number): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM shops WHERE id = ${id}`
}
