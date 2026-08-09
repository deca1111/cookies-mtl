'use client'

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/lib/maplibre-setup'
import { useEffect, useRef, useState } from 'react'
import { logout } from '@/app/actions/auth'
import { createShopAction, deleteShopAction, updateShopAction } from '@/app/actions/shops'
import { buildMapStyle, currentTheme, getMapStyleUrl } from '@/lib/map-style'
import { sortShops, type SortDir } from '@/lib/shop-sort'
import type { Shop } from '@/lib/shops'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AdminHeader } from './AdminHeader'
import { PlaceSearch, type PickedPlace } from './PlaceSearch'
import { RatingInput } from './RatingInput'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

type Draft = PickedPlace & { rating: number; review: string; id?: number }

export function AdminApp({ shops }: { shops: Shop[] }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftSession, setDraftSession] = useState(0)
  const [manualName, setManualName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'name' | 'rating'>('rating')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [relocating, setRelocating] = useState(false)
  const mapDiv = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  // Clé « lat,lng » du dernier géocodage inverse tenté — voir l'effet plus bas.
  const reverseAttempted = useRef<string | null>(null)

  // Opens a draft and bumps the session counter, so the mini-map effect (keyed on
  // draftSession) only rebuilds the map when a NEW draft is opened — not on every
  // keystroke of the in-form fields (name, address, review, etc.).
  const openDraft = (d: Draft) => {
    reverseAttempted.current = null
    setDraft(d)
    setDraftSession((s) => s + 1)
  }

  // Task 17b bug 1: closing a draft (save or cancel) used to leave `draftSession`
  // unchanged, so the mini-map effect's cleanup (`map.remove()`) never ran on close —
  // only at the *next* openDraft, right before building the replacement map. That left
  // one orphaned MapLibre instance + live WebGL context behind for as long as the admin
  // stayed on the list view, and mobile browsers cap simultaneous WebGL contexts (~8 on
  // iOS Safari); repeated add/cancel cycles in the same tab march toward that cap and the
  // OLDEST context (often the public map, in another tab/session sharing the same GPU
  // budget) gets force-lost. Bumping draftSession on close makes the effect re-run
  // immediately: its cleanup removes the old map, then the effect body sees `draft ===
  // null` and returns early instead of building a new one — so the mini-map is destroyed
  // right away instead of lingering.
  const closeDraft = () => {
    setDraft(null)
    setManualName(null)
    setRelocating(false)
    setDraftSession((s) => s + 1)
  }

  // Mini confirmation map with a draggable pin, shown whenever a draft has coords.
  // Theme-aware like CookieMap: same `currentTheme()` + `getMapStyleUrl()` pathway. The
  // Map is still constructed synchronously (no pre-fetch of the style JSON) so opening a
  // draft keeps building exactly one map — see the stability test below this component.
  // The palette is instead applied once the (stock-coloured) style has loaded, via the
  // guarded `once`/`getStyle`/`setStyle` calls, which the maplibre-gl vitest mock — built
  // for the test above and not implementing those methods — simply skips.
  useEffect(() => {
    if (!draft || !mapDiv.current) return
    const theme = currentTheme()
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: getMapStyleUrl(theme),
      center: [draft.lng, draft.lat],
      zoom: 16,
      attributionControl: { compact: true },
      // Round 2 — footprint reduction (iPhone incident), applied here too for consistency
      // with the public map: cap the render pixel ratio at 2 to bound GPU memory footprint
      // on high-DPI mobile screens.
      pixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
      // Round 3 — same rationale as CookieMap.tsx's MAX_TILE_CACHE_SIZE: unset defaults to a
      // viewport-scaled dynamic cache, a documented iOS OOM crash mechanism. Applied here too
      // for consistency, though this mini-map isn't implicated in the incident.
      maxTileCacheSize: 40,
    })
    if (typeof map.once === 'function') {
      map.once('style.load', () => {
        if (typeof map.getStyle === 'function' && typeof map.setStyle === 'function') {
          // buildMapStyle = simplification épurée + palette + halo, la même fabrique
          // que la carte publique et le pipeline de tuiles (spec carte hybride §1).
          map.setStyle(buildMapStyle(map.getStyle(), theme))
        }
      })
    }
    const marker = new maplibregl.Marker({ draggable: true }).setLngLat([draft.lng, draft.lat]).addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      // Adresse vidée exprès : l'effet de géocodage inverse la re-dérive des
      // nouvelles coordonnées (spec v1.2 §8 — l'adresse n'est jamais saisie).
      setDraft((d) => (d ? { ...d, lat, lng, address: '' } : d))
    })
    markerRef.current = marker
    return () => {
      map.remove()
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSession])

  // Spec v1.2 §8 : coordonnées sans adresse (lien Google, manuel, drag du pin)
  // → géocodage inverse Photon via /api/places. `stale` neutralise les réponses
  // en retard quand le point a rebougé entre-temps. S'applique AUSSI aux adresses
  // sans numéro civique (cas « Bernice » : la fiche Photon n'en portait pas) —
  // l'inverse s'accroche au point adresse le plus proche, qui a le numéro.
  // `reverseAttempted` (clé lat,lng) évite de boucler si l'inverse n'a pas mieux.
  useEffect(() => {
    if (!draft) return
    const hadAddress = draft.address !== ''
    if (hadAddress && /^\d/.test(draft.address)) return
    const key = `${draft.lat},${draft.lng}`
    if (reverseAttempted.current === key) return
    reverseAttempted.current = key
    const { lat, lng } = draft
    let stale = false
    fetch(`/api/places?lat=${lat}&lng=${lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { address?: string | null } | null) => {
        if (stale || !data?.address) return
        // Une adresse existante (sans numéro) n'est remplacée que si l'inverse
        // apporte réellement le numéro — sinon on garde le libellé Photon.
        if (hadAddress && !/^\d/.test(data.address)) return
        setDraft((d) => (d && d.lat === lat && d.lng === lng ? { ...d, address: data.address as string } : d))
      })
      .catch(() => {})
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.lat, draft?.lng, draft?.address])

  const startManual = (typedName: string) => {
    setManualName(typedName)
    openDraft({ name: typedName, address: '', lat: MTL_CENTER[1], lng: MTL_CENTER[0], googleMapsUrl: '', rating: 0, review: '' })
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setError(null)
    const payload = { ...draft }
    try {
      const res = draft.id ? await updateShopAction(draft.id, payload) : await createShopAction(payload)
      if (!res.ok) {
        setError(res.error)
        return
      }
      closeDraft()
    } catch {
      setError('server')
    } finally {
      setSaving(false)
    }
  }

  const pickSort = (k: 'name' | 'rating') => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(k)
      setSortDir(k === 'name' ? 'asc' : 'desc')
    }
  }

  const remove = async (shop: Shop) => {
    if (!window.confirm(`Supprimer « ${shop.name} » ?`)) return
    try {
      await deleteShopAction(shop.id)
    } catch {
      window.alert('La suppression a échoué — réessaie.')
    }
  }

  const errorLabels: Record<string, string> = {
    name: 'Le nom est requis.',
    address: 'Adresse introuvable — déplace le point ou relance une recherche.',
    position: 'La position doit être à Montréal.',
    rating: 'Choisis une note (0 à 5, par demi-cookie).',
    googleMapsUrl: 'Le lien Google est invalide.',
    review: 'L’avis est trop long.',
    server: 'Erreur serveur — réessaie, ta saisie est conservée.',
  }

  const field =
    'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-4 py-3 text-[15px] text-[color:var(--text-strong)] placeholder:text-[color:var(--text-muted)]'
  const card =
    'flex flex-col gap-4 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-chip)]'
  const eyebrow =
    'text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--text-muted)]'

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 pb-16 sm:max-w-xl sm:p-5 lg:max-w-2xl">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <AdminHeader />
        <div className="flex items-center gap-3">
          {/* Retour QA v1.1 : le toggle sombre/clair manquait à l'admin. */}
          <ThemeToggle className="flex h-[34px] w-[46px] items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-body)] shadow-[var(--shadow-chip)] transition-colors hover:bg-[color:var(--surface-2)]" />
          <button
            onClick={() => logout()}
            className="text-[13px] text-[color:var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--text-strong)]"
          >
            Se déconnecter
          </button>
        </div>
      </header>

      <section className={card}>
        <h2 className={eyebrow}>Ajouter un cookie</h2>
        <PlaceSearch onPick={(p) => openDraft({ ...p, rating: 0, review: '' })} onManualRequest={startManual} />
      </section>

      {/* Création et édition partagent le MÊME modal (spec v1.2 §7, style unifié). */}
      {draft && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:items-center"
          onClick={() => {
            closeDraft()
            setError(null)
          }}
        >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={draft.id ? 'Modifier un cookie' : 'Ajouter un cookie'}
          onClick={(e) => e.stopPropagation()}
          className={`${card} my-6 w-full max-w-lg sm:my-0`}
        >
          <h2 className={eyebrow}>{draft.id ? 'Modifier' : 'C’est bien ici ?'}</h2>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nom du magasin"
            className={field}
          />
          {/* Spec v1.2 §8 : adresse + position = bloc atomique. L'adresse s'affiche
              en lecture seule et ne change qu'en re-passant par la recherche (ou par
              géocodage inverse après un drag du pin) — jamais de saisie libre. */}
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-3">
            <p className="min-w-0 flex-1 text-[14px] text-[color:var(--text-body)]">
              {draft.address || 'Adresse en cours de recherche…'}
            </p>
            <button
              type="button"
              onClick={() => setRelocating(true)}
              className="shrink-0 text-[13px] text-[color:var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--text-strong)]"
            >
              Changer le lieu
            </button>
          </div>
          {relocating && (
            <PlaceSearch
              onPick={(p) => {
                // Bloc atomique : adresse + lat + lng remplacés ensemble. Nom et
                // lien Google conservés (éditables à part).
                setDraft((d) => (d ? { ...d, address: p.address, lat: p.lat, lng: p.lng } : d))
                setRelocating(false)
                setDraftSession((s) => s + 1) // recentre la mini-carte sur le nouveau lieu
              }}
              onManualRequest={() => setRelocating(false)}
            />
          )}
          <div
            ref={mapDiv}
            className="h-52 w-full overflow-hidden rounded-[var(--radius-field)] border border-[color:var(--border-strong)]"
          />
          <details className="group">
            <summary className="cursor-pointer list-none text-[13px] text-[color:var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--text-strong)]">
              Lien fiche Google (avancé)
            </summary>
            <input
              value={draft.googleMapsUrl}
              onChange={(e) => setDraft({ ...draft, googleMapsUrl: e.target.value })}
              placeholder="Auto si vide"
              className={`mt-3 w-full ${field}`}
            />
          </details>
          {manualName !== null && (
            <p className="text-[13px] text-[color:var(--text-muted)]">Glisse le point sur le magasin.</p>
          )}
          <RatingInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
          <textarea
            value={draft.review}
            onChange={(e) => setDraft({ ...draft, review: e.target.value })}
            placeholder="Ton avis…"
            rows={3}
            className={`resize-none leading-relaxed ${field}`}
          />
          {error && <p className="text-[13px] text-[color:var(--danger)]">{errorLabels[error] ?? 'Erreur — réessaie.'}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-5 py-3 text-[15px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)] disabled:opacity-60"
            >
              {saving ? '…' : 'Enregistrer'}
            </button>
            <button
              onClick={() => { closeDraft(); setError(null) }}
              className="px-1 text-[13px] text-[color:var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--text-strong)]"
            >
              Annuler
            </button>
          </div>
        </section>
        </div>
      )}

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={eyebrow}>Les cookies ({shops.length})</h2>
          <div className="flex gap-1.5">
            {(['name', 'rating'] as const).map((k) => (
              <button
                key={k}
                onClick={() => pickSort(k)}
                aria-pressed={sortKey === k}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                  sortKey === k
                    ? 'border-[color:var(--accent-gold)] bg-[color:var(--accent-gold)] text-[color:var(--accent-gold-ink)]'
                    : 'border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--text-body)]'
                }`}
              >
                {k === 'name' ? 'Nom' : 'Note'}
                {sortKey === k && (
                  <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className={sortDir === 'asc' ? 'rotate-180' : ''}>
                    <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        <ul className="-my-1 divide-y divide-[color:var(--border)]">
          {sortShops(shops, sortKey, sortDir).map((shop) => (
            <li
              key={shop.id}
              data-editing={draft?.id === shop.id || undefined}
              className="flex items-center justify-between gap-4 py-3 data-[editing]:-mx-2 data-[editing]:rounded-lg data-[editing]:border-l-2 data-[editing]:border-[color:var(--accent)] data-[editing]:bg-[color:var(--accent-wash)] data-[editing]:px-2"
            >
              <div className="min-w-0">
                <span className="font-display block truncate text-[17px] text-[color:var(--text-strong)]">
                  {shop.name}
                </span>
                <span className="text-[13px] text-[color:var(--text-muted)]">
                  {String(shop.rating).replace('.', ',')} / 5
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-[13px] sm:flex-row sm:items-center sm:gap-3">
                <button
                  onClick={() => openDraft({ ...shop, id: shop.id })}
                  className="text-[color:var(--text-body)] underline underline-offset-4 transition-colors hover:text-[color:var(--accent-ink)]"
                >
                  Modifier
                </button>
                <button
                  onClick={() => remove(shop)}
                  className="text-[color:var(--danger)] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
