// Échelle de cookies + note chiffrée. Layout validé v1.2 pour la fiche (`sheet`) :
// cookies dominants (27 px) puis chiffre en Gill Sans 30 px avec « /5 » discret.
// `row` = version compacte du panneau liste ; `lg` = look historique de l'admin.
export function RatingCookies({
  rating,
  variant = 'sheet',
}: {
  rating: number
  variant?: 'sheet' | 'row' | 'lg'
}) {
  const px = variant === 'sheet' ? 27 : variant === 'lg' ? 32 : 13
  const num = String(rating).replace('.', ',')
  const label = `${num} / 5`
  const kinds = Array.from({ length: 5 }, (_, i) => {
    if (rating >= i + 1) return 'full' as const
    if (rating >= i + 0.5) return 'half' as const
    return 'empty' as const
  })
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center ${variant === 'sheet' ? 'gap-3' : variant === 'lg' ? 'gap-2.5' : 'gap-1.5'}`}
    >
      <span aria-hidden className="inline-flex items-center gap-1">
        {kinds.map((kind, i) => (
          <svg key={i} width={px} height={px} viewBox="0 0 300 300" data-cookie={kind}>
            <use href={`#cmtl-cookie-${kind}`} />
          </svg>
        ))}
      </span>
      {variant === 'sheet' ? (
        // 22px = la taille du nom du commerce dans la fiche (retour Léo : la note
        // ne doit pas dominer le titre).
        <span aria-hidden className="font-display text-[22px] leading-none text-[color:var(--accent-ink)]">
          {num}
          <span className="text-[13px] text-[color:var(--text-muted)]"> /5</span>
        </span>
      ) : variant === 'lg' ? (
        <span aria-hidden className="text-[14px] font-semibold leading-none text-[color:var(--text-muted)]">
          {num}
        </span>
      ) : (
        <span aria-hidden className="font-display text-[12px] leading-none text-[color:var(--accent-ink)]">
          {num}
        </span>
      )}
    </span>
  )
}
