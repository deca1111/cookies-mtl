import { BrandLogo } from './BrandLogo'

// Habillage variante A (validée sur maquette, mémoire projet) : logo haut-gauche,
// crédit bas-gauche. B (bandeau) et C (crédit sous logo) sont en réserve.
export function MapChrome() {
  return (
    <>
      <div className="absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow-chip)]">
        <BrandLogo size={44} />
      </div>
      <p className="absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-3 z-10 rounded-full bg-[color:var(--surface)]/80 px-2.5 py-1 text-[10px] text-[color:var(--text-muted)]">
        by Zucchini Studio
      </p>
    </>
  )
}
