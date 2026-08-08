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

  const shareUrl = `${window.location.origin}/c/${shop.slug}`

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
    <div className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl bg-[color:var(--sheet-bg)] p-5 pb-8 shadow-[0_-6px_24px_rgba(0,0,0,0.15)]">
      <button aria-label={t('close')} onClick={onClose} className="absolute right-4 top-3 text-[color:var(--text-muted)]">
        ✕
      </button>
      <h2 className="font-serif text-xl text-[color:var(--text-strong)]">{shop.name}</h2>
      <RatingCookies rating={shop.rating} />
      {shop.review && <p className="mt-2 text-[color:var(--text-body)]">{shop.review}</p>}
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{shop.address}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={onDirections} className="rounded-full bg-[color:var(--btn-bg)] px-5 py-2.5 text-[color:var(--btn-text)]">
          {t('directions')}
        </button>
        <button onClick={onCopy} className="rounded-full border border-[color:var(--border)] px-5 py-2.5">
          {copied ? t('copied') : t('copyAddress')}
        </button>
        <button onClick={onShare} className="rounded-full border border-[color:var(--border)] px-5 py-2.5">
          {linkCopied ? t('linkCopied') : t('share')}
        </button>
        <a
          href={shop.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          {t('googleListing')} ↗
        </a>
      </div>

      {iosChooser && (
        <div className="mt-3 flex gap-2">
          <a href={appleMapsUrl(shop.lat, shop.lng)} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm">
            {t('openInPlans')}
          </a>
          <a href={googleDirectionsUrl(shop.lat, shop.lng)} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm">
            {t('openInGoogleMaps')}
          </a>
        </div>
      )}
    </div>
  )
}
