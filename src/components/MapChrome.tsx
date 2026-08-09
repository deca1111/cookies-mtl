import { BrandLogo } from './BrandLogo'

// Habillage variante A (validée sur maquette, mémoire projet) : logo haut-gauche,
// crédit bas-gauche. B (bandeau) et C (crédit sous logo) sont en réserve.
// Depuis la v1.2, la pastille logo ouvre la popup explicative (spec §5).
export function MapChrome({ onLogoClick }: { onLogoClick?: () => void }) {
  return (
    <>
      <button
        onClick={onLogoClick}
        aria-label="Cookies Club"
        className="absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 cursor-pointer rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow-chip)]"
      >
        <BrandLogo size={88} />
      </button>
      {/* Premier plan (z-30, au-dessus de la fiche) : le crédit est minuscule et ne
          recouvre rien d'interactif — retour QA v1.1. */}
      <a
        href="https://zucchinistudio.com"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-3 z-30 rounded-full bg-[color:var(--surface)]/80 px-2.5 py-1 text-[10px] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--accent-ink)] hover:underline underline-offset-2"
      >
        with love by Zucchini Studio
      </a>
    </>
  )
}
