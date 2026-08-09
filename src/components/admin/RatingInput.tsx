'use client'

import { RatingCookies } from '@/components/RatingCookies'

// Retour QA v1 : les 🍪 à opacité variable rendaient la demi-note illisible.
// Nouveau contrat : un slider (pas de 0,5) + la MÊME visualisation cookies que
// le site public — l'admin voit exactement ce que les visiteurs verront.
export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      role="group"
      aria-label={`Note : ${String(value).replace('.', ',')} / 5`}
      className="flex flex-col gap-3 rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-4 py-3"
    >
      <RatingCookies rating={value} variant="lg" />
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value}
        data-testid="rating-slider"
        aria-label="Note sur 5, par demi-point"
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-[color:var(--accent)]"
      />
    </div>
  )
}
