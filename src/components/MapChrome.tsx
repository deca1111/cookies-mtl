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
      {/* z-[15] : au-dessus de la carte mais SOUS la fiche (z-20) et le panneau
          liste — il intersectait leurs coins (QA v1.2 round 3). Quand une surface
          s'ouvre, elle recouvre le crédit ; carte nue, il reste visible. */}
      <a
        href="https://zucchinistudio.com"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-3 z-[15] rounded-full bg-[color:var(--surface)]/80 px-2.5 py-1 text-[10px] text-[color:var(--accent-blue)] transition-colors hover:underline underline-offset-2"
      >
        with love by Zucchini Studio
      </a>
    </>
  )
}
