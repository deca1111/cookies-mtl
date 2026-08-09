'use client'

import { useEffect } from 'react'
import { SITE_BRAND, SITE_CONTACT_EMAIL, SITE_INSTAGRAM_URL } from '@/lib/site'
import { useLang } from './LangProvider'
import { IconClose, IconInstagram, IconMail } from './icons'

// Clé localStorage : la popup ne s'auto-ouvre qu'à la première visite (spec v1.2 §5) ;
// ensuite elle reste accessible via la pastille logo.
export const INTRO_SEEN_KEY = 'cmtl_intro_seen'

export function IntroPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang } = useLang()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const langBtn = (l: 'fr' | 'en', label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      aria-label={l === 'fr' ? 'Français' : 'English'}
      className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-[0.08em] transition-colors ${
        lang === l
          ? 'bg-[color:var(--btn-bg)] text-[color:var(--btn-text)]'
          : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={SITE_BRAND}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[380px] rounded-[var(--radius-sheet)] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-float)]"
      >
        <button
          aria-label={t('close')}
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-strong)]"
        >
          <IconClose />
        </button>
        <h2 className="font-display pr-8 text-[24px] leading-tight text-[color:var(--text-strong)]">{SITE_BRAND}</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--text-body)]">{t('introBody')}</p>
        <div className="mt-5 flex flex-col gap-2.5">
          <a
            href={SITE_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] text-[color:var(--accent-ink)] underline-offset-4 hover:underline"
          >
            <IconInstagram size={15} /> {t('introInstagram')}
          </a>
          <a
            href={`mailto:${SITE_CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 text-[14px] text-[color:var(--accent-ink)] underline-offset-4 hover:underline"
          >
            <IconMail size={15} /> {t('introEmail')}
          </a>
        </div>
        <div className="mt-5 flex items-center gap-1 border-t border-[color:var(--border)] pt-4">
          {langBtn('fr', 'FR')}
          {langBtn('en', 'EN')}
        </div>
      </div>
    </div>
  )
}
