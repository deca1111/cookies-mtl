import { ordinal } from '@/lib/contest-i18n'

// Médailles du podium : or, argent, bronze, au ruban bleu de la marque. Les
// rangs suivants n'en ont pas — un simple chiffre, pour que le podium se
// distingue d'un coup d'œil.
const MEDALS: Record<1 | 2 | 3, { light: string; mid: string; dark: string }> = {
  1: { light: '#fff1c9', mid: '#f3c787', dark: '#a8701f' },
  2: { light: '#f6f7f9', mid: '#c9ced6', dark: '#6f7883' },
  3: { light: '#f3c49a', mid: '#cd8648', dark: '#74400f' },
}

export function Medal({ position, size, className = '' }: { position: number; size: number; className?: string }) {
  const c = MEDALS[position as 1 | 2 | 3] ?? MEDALS[3]
  const id = `rv-medal-${position}`
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.55" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </radialGradient>
      </defs>
      <path d="M22 0h20l18 56-14 8z" fill="#4560a9" />
      <path d="M78 0H58L40 56l14 8z" fill="#7f98e0" />
      <circle cx="50" cy="88" r="38" fill={`url(#${id})`} />
      <circle cx="50" cy="88" r="29" fill="none" stroke={c.dark} strokeWidth="2.5" opacity="0.5" />
      <text x="50" y="99" textAnchor="middle" fontSize="30" fill="#2c1f16" className="font-display">{ordinal('fr', position)}</text>
    </svg>
  )
}

// Avant le verdict du duel : la place de la médaille, encore vide.
export function MysteryMedal({ size, className = '' }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden="true" className={className}>
      <path d="M22 0h20l18 56-14 8zM78 0H58L40 56l14 8z" fill="none" stroke="#f4ebdd" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="50" cy="88" r="38" fill="none" stroke="#f4ebdd" strokeOpacity="0.3" strokeWidth="2.5" strokeDasharray="6 5" />
      <text x="50" y="100" textAnchor="middle" fontSize="34" fill="#f4ebdd" fillOpacity="0.35" className="font-display">?</text>
    </svg>
  )
}
