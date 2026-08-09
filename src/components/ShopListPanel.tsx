'use client'

import { useEffect, useRef, useState } from 'react'
import type { Shop } from '@/lib/shops'
import { distanceMeters, formatDistance, sortShops, type Origin, type SortDir, type SortKey } from '@/lib/shop-sort'
import { useLang } from './LangProvider'
import { RatingCookies } from './RatingCookies'

// Panneau liste (spec v1.2 §6, variante « riche » validée sur maquette) : drawer
// gauche par-dessus la carte, tri note/A–Z/distance, tap = fiche sur la carte.
const DEFAULT_DIR: Record<SortKey, SortDir> = { distance: 'asc', name: 'asc', rating: 'desc' }

// Durée de fermeture (cmtl-drawer-out) + marge — fallback minuterie si
// animationend ne vient pas (jsdom, prefers-reduced-motion).
const CLOSE_ANIMATION_MS = 320

function SortArrow({ dir }: { dir: SortDir }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={dir === 'asc' ? 'rotate-180' : ''}>
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function ShopListPanel({
  shops,
  open,
  onClose,
  onPick,
}: {
  shops: Shop[]
  open: boolean
  onClose: () => void
  onPick: (s: Shop) => void
}) {
  const { t } = useLang()
  const [key, setKey] = useState<SortKey>('rating')
  const [dir, setDir] = useState<SortDir>('desc')
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [geoError, setGeoError] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  // Même précaution que l'IntroPopup : `closing` retombe à false quand la
  // fermeture aboutit, sinon la réouverture flasherait une frame « fermée ».
  const finishClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setClosing(false)
    onClose()
  }

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    closeTimer.current = setTimeout(finishClose, CLOSE_ANIMATION_MS)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing])

  if (!open) return null

  const pickSort = (k: SortKey) => {
    if (k === 'distance' && !origin) {
      // Géoloc demandée à la première activation seulement ; l'échec n'écrase pas le tri courant.
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setGeoError(false)
          setKey('distance')
          setDir('asc')
        },
        () => setGeoError(true)
      )
      return
    }
    if (k === key) {
      setDir(dir === 'asc' ? 'desc' : 'asc')
    } else {
      setKey(k)
      setDir(DEFAULT_DIR[k])
    }
  }

  const sorted = sortShops(shops, key, dir, origin)

  const chip = (k: SortKey, label: string) => (
    <button
      onClick={() => pickSort(k)}
      aria-pressed={key === k}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        key === k
          ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--btn-text)]'
          : 'border-[color:var(--border-strong)] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)]'
      }`}
    >
      {label}
      {key === k && <SortArrow dir={dir} />}
    </button>
  )

  return (
    <>
      {/* Voile : tap = fermer (validé sur maquette). */}
      <div
        data-closing={closing || undefined}
        className="cmtl-drawer-scrim fixed inset-0 z-30 bg-black/20"
        onClick={requestClose}
        aria-hidden="true"
      />
      <section
        aria-label={t('listTitle')}
        data-closing={closing || undefined}
        onAnimationEnd={() => {
          if (closing) finishClose()
        }}
        className="cmtl-drawer fixed inset-y-0 left-0 z-40 flex w-[86%] max-w-[360px] flex-col bg-[color:var(--surface)] shadow-[var(--shadow-float)]"
      >
        <header className="flex items-center justify-between px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
          <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('listTitle')}</h2>
          <button
            aria-label={t('listClose')}
            onClick={requestClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)]"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M6.5 1 L2.5 5 L6.5 9" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>
        <div className="flex gap-1.5 px-4 pb-3">
          {chip('distance', t('sortDistance'))}
          {chip('name', t('sortName'))}
          {chip('rating', t('sortRating'))}
        </div>
        {geoError && <p className="px-4 pb-2 text-[12px] text-[color:var(--text-muted)]">{t('geoUnavailable')}</p>}
        <ul
          role="list"
          className="min-h-0 flex-1 divide-y divide-[color:var(--border)] overflow-y-auto overscroll-contain border-t border-[color:var(--border)] pb-[env(safe-area-inset-bottom)]"
        >
          {sorted.map((shop) => (
            <li key={shop.id}>
              <button
                onClick={() => {
                  // La fiche s'ouvre tout de suite (la caméra part) pendant que
                  // le drawer glisse vers la gauche.
                  onPick(shop)
                  requestClose()
                }}
                aria-label={`${shop.name} — ${t('seeDetails')}`}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--surface-2)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate text-[15px] text-[color:var(--text-strong)]">
                    {shop.name}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <RatingCookies rating={shop.rating} variant="row" />
                    {origin && (
                      <span className="text-[12px] text-[color:var(--text-muted)]">
                        · {formatDistance(distanceMeters(origin, shop))}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-[color:var(--text-muted)]">{shop.address}</span>
                </span>
                <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0 text-[color:var(--accent)]">
                  <path d="M3.5 1 L7.5 5 L3.5 9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
