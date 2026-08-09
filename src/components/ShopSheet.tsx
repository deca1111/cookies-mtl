'use client'

import { useRef, useState } from 'react'
import type { Shop } from '@/lib/shops'
import { DirectionsModal } from './DirectionsModal'
import { useLang } from './LangProvider'
import { RatingCookies } from './RatingCookies'
import { IconCheck, IconClose, IconCopy, IconDirections, IconExternal, IconShare } from './icons'

export function ShopSheet({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef<{ startY: number; startT: number } | null>(null)

  const onDirections = () => setDirectionsOpen(true)

  // Geste vertical sur la zone de poignée : vers le bas la fiche suit le doigt
  // (indice visuel) puis ferme au relâcher. Le cran d'agrandissement a été retiré
  // (retour QA v1.1 : inutile, le contenu tient dans le cran compact).
  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startT: e.timeStamp }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    setDragY(e.clientY - dragRef.current.startY)
  }
  const onDragEnd = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dy = e.clientY - dragRef.current.startY
    const vy = dy / Math.max(1, e.timeStamp - dragRef.current.startT) // px/ms
    dragRef.current = null
    setDragY(0)
    if (dy > 50 || vy > 0.4) onClose()
  }

  const onCopy = async () => {
    await navigator.clipboard.writeText(shop.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onShare = async () => {
    const shareUrl = `${window.location.origin}/c/${shop.slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.name, url: shareUrl })
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  return (
    // Task 17b bug 2: a long review used to grow this fixed-position sheet taller than the
    // viewport with nothing to scroll it (the CookieMap wrapper's `overflow-hidden` doesn't
    // clip `fixed` descendants), pushing the action row off-screen with no way to reach it.
    // Fix: cap the sheet at a max-height and split it into a scrollable content region (the
    // part that can grow — title/rating/review/address) plus a `shrink-0` footer (the action
    // row) that always stays visible below it. Same split on the sm: desktop floating card.
    <div
      className="cmtl-sheet fixed inset-x-0 bottom-0 z-20 flex max-h-[70dvh] flex-col rounded-t-[var(--radius-sheet)] border-t border-[color:var(--border)] bg-[color:var(--surface)] px-5 shadow-[var(--shadow-sheet)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-h-[min(70vh,640px)] sm:w-[380px] sm:rounded-[var(--radius-sheet)] sm:border sm:shadow-[var(--shadow-float)]"
      style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : undefined }}
    >
      {/* Poignée de drag : couvre la bande du handle + le haut de l'en-tête. touch-none
          pour que le navigateur n'interprète pas le geste comme un scroll. Cachée en
          desktop (sm:) où la fiche est une carte flottante sans geste. */}
      <div
        data-drag-zone
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="absolute inset-x-0 top-0 z-10 h-10 cursor-grab touch-none sm:hidden"
      />
      <button
        aria-label={t('close')}
        onClick={onClose}
        className="absolute right-3 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full text-[13px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-strong)] sm:top-3"
      >
        <IconClose />
      </button>

      {/* Scrollable region: `touch-pan-y` + `overscroll-contain` keep vertical drags native
          to this element even though it sits above the MapLibre canvas (fixed, z-20); the
          canvas itself never receives these touches since the sheet isn't its DOM descendant,
          but `stopPropagation` is kept as a defensive belt-and-suspenders per the QA brief. */}
      <div
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pt-6 sm:pt-5"
        onTouchMove={(e) => e.stopPropagation()}
      >
        <h2 className="font-display pr-9 text-[22px] leading-[1.15] text-[color:var(--text-strong)]">{shop.name}</h2>
        <div className="mt-2">
          <RatingCookies rating={shop.rating} />
        </div>
        {shop.review && (
          <p className="cmtl-verdict mt-3 text-[17px] leading-[1.45] text-[color:var(--text-body)]">{shop.review}</p>
        )}
        {/* Retour QA v1.1 : « Copier » incompris en CTA — l'icône vit désormais
            contre l'adresse qu'elle copie, avec toast de confirmation. */}
        <div className="mt-3 flex items-center gap-2 border-t border-[color:var(--border)] pt-3 pb-1">
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-[color:var(--text-muted)]">{shop.address}</p>
          <button
            onClick={onCopy}
            aria-label={t('copyAddressFull')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-strong)] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)] active:scale-[0.98]"
          >
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          </button>
        </div>
      </div>

      <div className="shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 sm:pb-6">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDirections}
            className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[color:var(--btn-bg)] px-3 text-[13px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)] active:scale-[0.98]"
          >
            <IconDirections size={15} />
            {t('directions')}
          </button>
          <button
            onClick={onShare}
            className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[color:var(--border-strong)] px-3 text-[13px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)] active:scale-[0.98]"
          >
            {linkCopied ? <IconCheck size={15} /> : <IconShare size={15} />}
            {linkCopied ? t('linkCopied') : t('share')}
          </button>
        </div>
        <div className="mt-2 text-right">
          <a href={shop.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="py-2.5 text-[13px] text-[color:var(--text-muted)] underline-offset-4 transition-colors hover:text-[color:var(--accent-ink)] hover:underline">
            <span className="inline-flex items-center gap-1">{t('googleListing')} <IconExternal size={13} /></span>
          </a>
        </div>
      </div>

      {copied && (
        <div
          role="status"
          className="cmtl-toast absolute -top-14 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color:var(--btn-bg)] px-4 py-2 text-[13px] font-medium text-[color:var(--btn-text)] shadow-[var(--shadow-chip)]"
        >
          {t('addressCopied')}
        </div>
      )}

      {directionsOpen && (
        <DirectionsModal lat={shop.lat} lng={shop.lng} onClose={() => setDirectionsOpen(false)} />
      )}
    </div>
  )
}
