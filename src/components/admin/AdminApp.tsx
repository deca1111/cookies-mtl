'use client'

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { logout } from '@/app/actions/auth'
import { createShopAction, deleteShopAction, updateShopAction } from '@/app/actions/shops'
import { getMapStyleUrl } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { PlaceSearch, type PickedPlace } from './PlaceSearch'
import { RatingInput } from './RatingInput'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

type Draft = PickedPlace & { rating: number; review: string; id?: number }

export function AdminApp({ shops }: { shops: Shop[] }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [manualName, setManualName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mapDiv = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  // Mini confirmation map with a draggable pin, shown whenever a draft has coords
  useEffect(() => {
    if (!draft || !mapDiv.current) return
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: getMapStyleUrl('light'),
      center: [draft.lng, draft.lat],
      zoom: 16,
      attributionControl: { compact: true },
    })
    const marker = new maplibregl.Marker({ draggable: true }).setLngLat([draft.lng, draft.lat]).addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      setDraft((d) => (d ? { ...d, lat, lng } : d))
    })
    markerRef.current = marker
    return () => {
      map.remove()
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.lat === undefined, draft?.name])

  const startManual = (typedName: string) => {
    setManualName(typedName)
    setDraft({ name: typedName, address: '', lat: MTL_CENTER[1], lng: MTL_CENTER[0], googleMapsUrl: '', rating: 0, review: '' })
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setError(null)
    const payload = { ...draft }
    const res = draft.id ? await updateShopAction(draft.id, payload) : await createShopAction(payload)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDraft(null)
    setManualName(null)
  }

  const remove = async (shop: Shop) => {
    if (!window.confirm(`Supprimer « ${shop.name} » ?`)) return
    await deleteShopAction(shop.id)
  }

  const errorLabels: Record<string, string> = {
    name: 'Le nom est requis.',
    address: "L'adresse est requise.",
    position: 'La position doit être à Montréal.',
    rating: 'Choisis une note (0 à 5, par demi-cookie).',
    googleMapsUrl: 'Le lien Google est invalide.',
    review: "L'avis est trop long.",
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-5 pb-16">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">🍪 Admin</h1>
        <button onClick={() => logout()} className="text-sm text-[color:var(--text-muted)] underline">
          Se déconnecter
        </button>
      </header>

      {!draft && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Ajouter un cookie</h2>
          <PlaceSearch onPick={(p) => setDraft({ ...p, rating: 0, review: '' })} onManualRequest={startManual} />
        </section>
      )}

      {draft && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg">{draft.id ? 'Modifier' : 'C’est bien ici ?'}</h2>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nom du magasin"
            className="rounded-xl border border-[color:var(--border)] px-4 py-3"
          />
          <input
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            placeholder="Adresse"
            className="rounded-xl border border-[color:var(--border)] px-4 py-3"
          />
          <div ref={mapDiv} className="h-52 w-full overflow-hidden rounded-xl border border-[color:var(--border)]" />
          <details>
            <summary className="cursor-pointer text-sm text-[color:var(--text-muted)]">Lien fiche Google (avancé)</summary>
            <input
              value={draft.googleMapsUrl}
              onChange={(e) => setDraft({ ...draft, googleMapsUrl: e.target.value })}
              placeholder="Auto si vide"
              className="mt-2 w-full rounded-xl border border-[color:var(--border)] px-4 py-3"
            />
          </details>
          {manualName !== null && (
            <p className="text-sm text-[color:var(--text-muted)]">Glisse le point sur le magasin.</p>
          )}
          <RatingInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
          <textarea
            value={draft.review}
            onChange={(e) => setDraft({ ...draft, review: e.target.value })}
            placeholder="Ton avis…"
            rows={3}
            className="rounded-xl border border-[color:var(--border)] px-4 py-3"
          />
          {error && <p className="text-sm text-red-600">{errorLabels[error] ?? 'Erreur — réessaie.'}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="rounded-xl bg-[color:var(--btn-bg)] px-5 py-3 text-[color:var(--btn-text)]">
              {saving ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => { setDraft(null); setManualName(null); setError(null) }} className="px-3 underline">
              Annuler
            </button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Les cookies ({shops.length})</h2>
        <ul className="divide-y divide-[color:var(--border)]">
          {shops.map((shop) => (
            <li key={shop.id} className="flex items-center justify-between py-3">
              <div>
                <span className="block">{shop.name}</span>
                <span className="text-sm text-[color:var(--text-muted)]">{String(shop.rating).replace('.', ',')} / 5</span>
              </div>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setDraft({ ...shop, id: shop.id })} className="underline">Modifier</button>
                <button onClick={() => remove(shop)} className="text-red-700 underline">Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
