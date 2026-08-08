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
    try {
      const resolved = await resolveLinkAction(link.trim())
      if (!resolved) {
        setLinkError(true)
        return
      }
      onPick({ ...resolved, address: '' })
    } catch {
      setLinkError(true)
    } finally {
      setBusy(false)
    }
  }

  const field =
    'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-4 py-3 text-[15px] text-[color:var(--text-strong)] placeholder:text-[color:var(--text-muted)]'
  const quietLink =
    'text-[color:var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--text-strong)]'

  if (mode === 'link') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-[color:var(--text-muted)]">
          Dans Google Maps : Partager → Copier le lien, puis colle-le ici.
        </p>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://maps.app.goo.gl/…"
          className={field}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submitLink}
            disabled={busy}
            className="rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-4 py-2.5 text-[14px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)] disabled:opacity-60"
          >
            {busy ? '…' : 'Utiliser ce lien'}
          </button>
          <button type="button" onClick={() => setMode('search')} className={`px-1 text-[13px] ${quietLink}`}>
            Retour à la recherche
          </button>
        </div>
        {linkError && (
          <p className="text-[13px] text-[color:var(--danger)]">
            Lien illisible.{' '}
            <button type="button" className="underline underline-offset-4" onClick={() => onManualRequest(q)}>
              Placer le point à la main
            </button>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nom du magasin…"
        autoFocus
        className={field}
      />
      {results.length > 0 && (
        <ul className="divide-y divide-[color:var(--border)] overflow-hidden rounded-[var(--radius-field)] border border-[color:var(--border)]">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick({ ...r, googleMapsUrl: '' })}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-[color:var(--surface-2)]"
              >
                <span className="font-serif block text-[16px] text-[color:var(--text-strong)]">{r.name}</span>
                <span className="mt-0.5 block text-[13px] text-[color:var(--text-muted)]">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <button type="button" onClick={() => setMode('link')} className={quietLink}>
            Je ne trouve pas — coller un lien Google Maps
          </button>
          <button type="button" onClick={() => onManualRequest(q)} className={quietLink}>
            Placer à la main
          </button>
        </div>
      )}
    </div>
  )
}
