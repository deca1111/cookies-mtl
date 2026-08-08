'use server'

import { updateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { resolveGoogleShareLink } from '@/lib/google-link'
import { googleListingSearchUrl } from '@/lib/nav-links'
import { deleteShop, insertShop, updateShop } from '@/lib/shops'
import { validateShopInput } from '@/lib/validate'

type ActionResult = { ok: true; slug: string } | { ok: false; error: string }

function withListingFallback(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.googleMapsUrl === 'string' && raw.googleMapsUrl.trim()) return raw
  return {
    ...raw,
    googleMapsUrl: googleListingSearchUrl(String(raw.name ?? ''), String(raw.address ?? '')),
  }
}

export async function createShopAction(raw: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin()
  const validated = validateShopInput(withListingFallback(raw))
  if (!validated.ok) return { ok: false, error: validated.error }
  const shop = await insertShop(validated.value)
  updateTag('shops')
  return { ok: true, slug: shop.slug }
}

export async function updateShopAction(id: number, raw: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin()
  const validated = validateShopInput(withListingFallback(raw))
  if (!validated.ok) return { ok: false, error: validated.error }
  await updateShop(id, validated.value)
  updateTag('shops')
  return { ok: true, slug: '' }
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
