'use server'

import { updateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { resolveGoogleShareLink } from '@/lib/google-link'
import { googleListingSearchUrl } from '@/lib/nav-links'
import { findDuplicate } from '@/lib/shop-duplicate'
import { deleteShop, insertShop, listShopIdentities, setShopInProgress, updateShop } from '@/lib/shops'
import { validateShopInput } from '@/lib/validate'

type ActionResult = { ok: true; slug: string } | { ok: false; error: string }

function withListingFallback(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.googleMapsUrl === 'string' && raw.googleMapsUrl.trim()) return raw
  return {
    ...raw,
    googleMapsUrl: googleListingSearchUrl(String(raw.name ?? ''), String(raw.address ?? '')),
  }
}

// Le contrôle d'unicité vit ICI, pas seulement dans l'admin : c'est le seul point
// que toute création doit franchir. Sans lui, `uniqueSlug` fabriquerait sagement
// un « -2 » et le doublon entrerait sans un mot — le bug d'origine.
export async function createShopAction(raw: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin()
  const validated = validateShopInput(withListingFallback(raw))
  if (!validated.ok) return { ok: false, error: validated.error }
  if (findDuplicate(await listShopIdentities(), validated.value)) return { ok: false, error: 'duplicate' }
  const shop = await insertShop(validated.value)
  updateTag('shops')
  return { ok: true, slug: shop.slug }
}

export async function updateShopAction(id: number, raw: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin()
  const validated = validateShopInput(withListingFallback(raw))
  if (!validated.ok) return { ok: false, error: validated.error }
  // Même garde au renommage : rebaptiser une fiche du nom de sa voisine créerait
  // le doublon que la création interdit. `id` s'exclut lui-même.
  if (findDuplicate(await listShopIdentities(), validated.value, id)) return { ok: false, error: 'duplicate' }
  await updateShop(id, validated.value)
  updateTag('shops')
  return { ok: true, slug: '' }
}

export async function setShopInProgressAction(id: number, inProgress: boolean): Promise<{ ok: boolean }> {
  await requireAdmin()
  await setShopInProgress(id, inProgress)
  updateTag('shops')
  return { ok: true }
}

export async function deleteShopAction(id: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  await deleteShop(id)
  updateTag('shops')
  return { ok: true }
}

export async function resolveLinkAction(shareUrl: string) {
  await requireAdmin()
  return resolveGoogleShareLink(shareUrl)
}
