'use client'

import { useEffect, useRef } from 'react'
import { appleMapsUrl, googleDirectionsUrl, wazeUrl } from '@/lib/nav-links'
import { useLang } from './LangProvider'
import { IconClose } from './icons'

export function DirectionsModal({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const { t } = useLang()
  const firstRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows = [
    { href: googleDirectionsUrl(lat, lng), label: t('googleMapsShort') },
    { href: appleMapsUrl(lat, lng), label: t('plansShort') },
    { href: wazeUrl(lat, lng), label: t('waze') },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('directionsTitle')}
      onClick={onClose}
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[var(--radius-sheet)] border-t border-[color:var(--border)] bg-[color:var(--surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:w-[340px] sm:rounded-[var(--radius-card)] sm:border"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-[16px] text-[color:var(--text-strong)]">{t('directionsTitle')}</h3>
          <button aria-label={t('close')} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)]">
            <IconClose />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <a
              key={r.label}
              ref={i === 0 ? firstRef : undefined}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center rounded-[var(--radius-field)] border border-[color:var(--border)] px-4 text-[14px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)]"
            >
              {r.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
