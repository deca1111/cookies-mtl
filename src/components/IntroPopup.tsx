'use client'

import { useEffect, useRef, useState } from 'react'
import { SITE_BRAND, SITE_INSTAGRAM_URL } from '@/lib/site'
import { parseIntroParagraphs } from '@/lib/intro-markup'
import { useLang } from './LangProvider'
import { IconClose, IconInstagram } from './icons'

// Clé localStorage : la popup ne s'auto-ouvre qu'à la première visite (spec v1.2 §5) ;
// ensuite elle reste accessible via la pastille logo.
export const INTRO_SEEN_KEY = 'cmtl_intro_seen'

// Durée de l'animation de fermeture (cmtl-intro-out) + marge : le démontage réel
// attend la fin de l'animation, avec un fallback minuterie si animationend ne
// vient pas (jsdom, prefers-reduced-motion).
const CLOSE_ANIMATION_MS = 240

export function IntroPopup({
  open,
  onClose,
  origin = 'logo',
}: {
  open: boolean
  onClose: () => void
  // 'logo' : apparition/fermeture animées depuis la pastille logo.
  // 'auto' : ouverture de première visite — PAS d'animation d'entrée (rien ne doit
  // ralentir la première peinture), la fermeture reste animée.
  origin?: 'auto' | 'logo'
}) {
  const { t, lang, setLang } = useLang()
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Réarmement à chaque réouverture (le composant reste monté entre deux).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClosing(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  // `closing` DOIT retomber à false au moment où la fermeture aboutit : le
  // composant reste monté entre deux ouvertures, et un `closing` résiduel
  // faisait flasher une frame « fermée » à la réouverture (QA round 2).
  const finishClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setClosing(false)
    onClose()
  }

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    // Fallback si animationend ne fire pas ; sinon onAnimationEnd ferme avant.
    closeTimer.current = setTimeout(finishClose, CLOSE_ANIMATION_MS)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing])

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
    <div
      data-closing={closing || undefined}
      className="cmtl-intro-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={SITE_BRAND}
        data-origin={origin}
        data-closing={closing || undefined}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => {
          if (closing) finishClose()
        }}
        className="cmtl-intro-card relative w-full max-w-[380px] rounded-[var(--radius-sheet)] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-float)]"
      >
        <button
          aria-label={t('close')}
          onClick={requestClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-strong)]"
        >
          <IconClose />
        </button>
        <h2 className="font-display pr-8 text-[24px] leading-tight text-[color:var(--text-strong)]">{SITE_BRAND}</h2>
        {/* Mini-format du texte (lib/intro-markup) : ligne vide = paragraphe,
            \n = saut de ligne (whitespace-pre-line), [mots] = typo titre. */}
        {parseIntroParagraphs(t('introBody')).map((para, i) => (
          <p key={i} className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-[color:var(--text-body)]">
            {para.map((seg, j) =>
              seg.display ? (
                <span key={j} className="font-display text-[color:var(--text-strong)]">
                  {seg.text}
                </span>
              ) : (
                <span key={j}>{seg.text}</span>
              )
            )}
          </p>
        ))}
        <div className="mt-5">
          <a
            href={SITE_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] text-[color:var(--accent-ink)] underline-offset-4 hover:underline"
          >
            <IconInstagram size={15} /> {t('introInstagram')}
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
