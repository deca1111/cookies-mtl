'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveLinkAction } from '@/app/actions/shops'
import type { PlaceResult } from '@/lib/photon'

export type PickedPlace = { name: string; address: string; lat: number; lng: number; googleMapsUrl: string }

// Three paths to a PickedPlace, in order of friction:
// 1. type → Photon suggestions → tap
// 2. "Je ne trouve pas" → paste a Google Maps share link
// 3. manual: type the name, place the pin on the mini-map (handled by parent via onManualRequest)
export function PlaceSearch({
  onPick,
  onManualRequest,
}: {
  onPick: (p: PickedPlace) => void
  onManualRequest: (typedName: string) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [mode, setMode] = useState<'search' | 'link'>('search')
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults((await res.json()).results)
      } catch {
        setResults([])
      }
    }, 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q])

  const submitLink = async () => {
    setBusy(true)
    setLinkError(false)
    const resolved = await resolveLinkAction(link.trim())
    setBusy(false)
    if (!resolved) {
      setLinkError(true)
      return
    }
    onPick({ ...resolved, address: '' })
  }

  if (mode === 'link') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[color:var(--text-muted)]">
          Dans Google Maps : Partager → Copier le lien, puis colle-le ici.
        </p>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://maps.app.goo.gl/…"
          className="rounded-xl border border-[color:var(--border)] px-4 py-3"
        />
        <div className="flex gap-2">
          <button type="button" onClick={submitLink} disabled={busy} className="rounded-xl bg-[color:var(--btn-bg)] px-4 py-2 text-[color:var(--btn-text)]">
            {busy ? '…' : 'Utiliser ce lien'}
          </button>
          <button type="button" onClick={() => setMode('search')} className="px-3 text-sm underline">
            Retour à la recherche
          </button>
        </div>
        {linkError && (
          <p className="text-sm text-red-600">
            Lien illisible. <button type="button" className="underline" onClick={() => onManualRequest(q)}>Placer le point à la main</button>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nom du magasin…"
        autoFocus
        className="rounded-xl border border-[color:var(--border)] px-4 py-3"
      />
      {results.length > 0 && (
        <ul className="divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)]">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick({ ...r, googleMapsUrl: '' })}
                className="w-full px-4 py-3 text-left"
              >
                <span className="block">{r.name}</span>
                <span className="block text-sm text-[color:var(--text-muted)]">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && (
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => setMode('link')} className="underline">
            Je ne trouve pas — coller un lien Google Maps
          </button>
          <button type="button" onClick={() => onManualRequest(q)} className="underline">
            Placer à la main
          </button>
        </div>
      )}
    </div>
  )
}
