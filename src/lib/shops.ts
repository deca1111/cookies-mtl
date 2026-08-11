import { cacheLife, cacheTag } from 'next/cache'
import { getSql } from './db'
import { uniqueSlug } from './slug'
import type { ShopInput } from './validate'

export type Shop = ShopInput & { id: number; slug: string; createdAt: string }

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

export async function insertShop(input: ShopInput): Promise<Shop> {
  const sql = getSql()
  const existing = (await sql`SELECT slug FROM shops`) as { slug: string }[]
  const slug = uniqueSlug(input.name, new Set(existing.map((r) => r.slug)))
  const rows = (await sql`
    INSERT INTO shops (slug, name, address, lat, lng, google_maps_url, rating, review, in_progress)
    VALUES (${slug}, ${input.name}, ${input.address}, ${input.lat}, ${input.lng},
            ${input.googleMapsUrl}, ${input.rating}, ${input.review}, ${input.inProgress})
    RETURNING *
  `) as Row[]
  return toShop(rows[0])
}

export async function updateShop(id: number, input: ShopInput): Promise<void> {
  const sql = getSql()
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
