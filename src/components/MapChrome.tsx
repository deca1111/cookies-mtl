import { BrandLogo } from './BrandLogo'

const LOGO_SIZE = 88
// Largeur commune au logo et au compteur : 88 (le logo) + 2 × 6 (padding) + 2 × 1
// (bordure). Portée par la colonne, pas recopiée sur chaque enfant — les deux
// pastilles restent alignées si la taille du logo change.
const COLUMN_WIDTH = LOGO_SIZE + 12 + 2

// Habillage variante A (validée sur maquette, mémoire projet) : logo haut-gauche,
// crédit bas-gauche. B (bandeau) et C (crédit sous logo) sont en réserve.
// Depuis la v1.2, la pastille logo ouvre la popup explicative (spec §5).
export function MapChrome({ onLogoClick, cookieCount }: { onLogoClick?: () => void; cookieCount: number }) {
  return (
    <>
      {/* Colonne de marque : logo puis compteur. La géolocalisation a été déplacée
          dans le coin droit pour la laisser respirer (voir globals.css).
          pointer-events-none sur la colonne : la gouttière entre les deux pastilles
          ne doit pas intercepter un geste destiné à la carte — seul le logo est
          cliquable, il le rétablit pour lui. */}
      <div
        style={{ width: COLUMN_WIDTH }}
        className="pointer-events-none absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 flex flex-col gap-2"
      >
        <button
          onClick={onLogoClick}
          aria-label="Cookies Club"
          className="pointer-events-auto cursor-pointer rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow-chip)]"
        >
          <BrandLogo size={LOGO_SIZE} />
        </button>

        {/* Décoratif, d'où aria-hidden : le nombre de fiches n'apprend rien à qui
            navigue au lecteur d'écran, et la liste les énumère déjà.
            Fond de surface et PAS de caramel : les aplats colorés du site sont
            réservés aux actions, une pastille remplie se lirait comme un bouton.
            Le chiffre est en font-display (Gill Sans Ultra Bold) — c'est de là que
            vient sa présence, pas de la couleur.
            « cookies » s'écrit pareil en français et en anglais : rien à traduire. */}
        <div
          aria-hidden="true"
          // Gouttière et padding serrés à dessein : la largeur étant fixée par la
          // colonne, « 100 cookies » débordait de 3 px. Le contenu étant centré,
          // ces marges ne se voient pas à deux chiffres.
          className="flex select-none items-baseline justify-center gap-1 whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-1.5 shadow-[var(--shadow-chip)]"
        >
          <span className="font-display text-[16px] leading-none text-[color:var(--accent-ink)]">
            {cookieCount}
          </span>
          {/* Interlettrage réduit plutôt que corps : c'est l'espacement des 7 lettres
              qui coûtait les derniers pixels manquants à trois chiffres. */}
          <span className="text-[9.5px] uppercase tracking-[0.05em] text-[color:var(--text-muted)]">
            cookies
          </span>
        </div>
      </div>

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
