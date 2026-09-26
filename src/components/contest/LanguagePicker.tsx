'use client'

import type { Lang } from '@/lib/i18n'

// Premier écran (spec §8), volontairement bilingue lui-même : on ne sait pas
// encore quelle langue lit la personne.
export function LanguagePicker({ onPick }: { onPick: (l: Lang) => void }) {
  const btn = 'w-full rounded-[var(--radius-card)] bg-[color:var(--btn-bg)] px-6 py-5 text-[20px] font-medium text-[color:var(--btn-text)] hover:bg-[color:var(--btn-bg-hover)]'
  return (
    <div className="flex flex-col items-center gap-6 pt-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marque statique */}
      <img src="/brand/logo.svg" alt="" className="h-24 w-24" />
      <h1 className="font-display text-center text-[26px] leading-tight text-[color:var(--text-strong)]">
        Choisis ta langue
        <br />
        <span className="text-[18px] italic text-[color:var(--text-muted)]">Choose your language</span>
      </h1>
      <button type="button" className={btn} onClick={() => onPick('fr')}>Français</button>
      <button type="button" className={btn} onClick={() => onPick('en')}>English</button>
    </div>
  )
}
