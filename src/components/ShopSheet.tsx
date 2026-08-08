'use client'

import { useState } from 'react'
import type { Shop } from '@/lib/shops'
import { appleMapsUrl, geoUri, googleDirectionsUrl } from '@/lib/nav-links'
import { useLang } from './LangProvider'
import { RatingCookies } from './RatingCookies'

function platform(): 'android' | 'ios' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  if (/android/i.test(navigator.userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'desktop'
}

export function ShopSheet({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [iosChooser, setIosChooser] = useState(false)

  const onDirections = () => {
    const p = platform()
    if (p === 'android') window.location.href = geoUri(shop.lat, shop.lng, shop.name)
    else if (p === 'ios') setIosChooser(true)
    else window.open(googleDirectionsUrl(shop.lat, shop.lng), '_blank', 'noopener')
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
    <div className="cmtl-sheet fixed inset-x-0 bottom-0 z-20 rounded-t-[var(--radius-sheet)] border-t border-[color:var(--border)] bg-[color:var(--surface)] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 shadow-[var(--shadow-sheet)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[380px] sm:rounded-[var(--radius-sheet)] sm:border sm:pt-5 sm:pb-6 sm:shadow-[var(--shadow-float)]">
      <button
        aria-label={t('close')}
        onClick={onClose}
        className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[13px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-strong)] sm:top-3"
      >
        ✕
      </button>
      <h2 className="font-serif pr-9 text-[22px] leading-[1.15] text-[color:var(--text-strong)]">{shop.name}</h2>
      <div className="mt-2">
        <RatingCookies rating={shop.rating} />
      </div>
      {shop.review && (
        <p className="cmtl-verdict mt-3 text-[17px] leading-[1.45] text-[color:var(--text-body)]">{shop.review}</p>
      )}
      <p className="mt-3 border-t border-[color:var(--border)] pt-3 text-[13px] leading-snug text-[color:var(--text-muted)]">
        {shop.address}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onDirections}
          className="rounded-full bg-[color:var(--btn-bg)] px-5 py-2.5 text-[14px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)] active:scale-[0.98]"
        >
          {t('directions')}
        </button>
        <button
          onClick={onCopy}
          className="rounded-full border border-[color:var(--border-strong)] px-4 py-2.5 text-[14px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)] active:scale-[0.98]"
        >
          {copied ? t('copied') : t('copyAddress')}
        </button>
        <button
          onClick={onShare}
          className="rounded-full border border-[color:var(--border-strong)] px-4 py-2.5 text-[14px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)] active:scale-[0.98]"
        >
          {linkCopied ? t('linkCopied') : t('share')}
        </button>
        <a
          href={shop.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto py-2.5 text-[13px] text-[color:var(--text-muted)] underline-offset-4 transition-colors hover:text-[color:var(--accent-ink)] hover:underline"
        >
          {t('googleListing')} ↗
        </a>
      </div>

      {iosChooser && (
        <div className="mt-3 flex gap-2 border-t border-[color:var(--border)] pt-3">
          <a
            href={appleMapsUrl(shop.lat, shop.lng)}
            className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)]"
          >
            {t('openInPlans')}
          </a>
          <a
            href={googleDirectionsUrl(shop.lat, shop.lng)}
            className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)]"
          >
            {t('openInGoogleMaps')}
          </a>
        </div>
      )}
    </div>
  )
}
