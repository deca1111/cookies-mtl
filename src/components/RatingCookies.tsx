export function RatingCookies({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 32 : 18
  const label = `${String(rating).replace('.', ',')} / 5`
  const kinds = Array.from({ length: 5 }, (_, i) => {
    if (rating >= i + 1) return 'full' as const
    if (rating >= i + 0.5) return 'half' as const
    return 'empty' as const
  })
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-2.5">
      <span aria-hidden className="inline-flex items-center gap-1">
        {kinds.map((kind, i) => (
          <svg key={i} width={px} height={px} viewBox="0 0 300 300" data-cookie={kind}>
            <use href={`#cmtl-cookie-${kind}`} />
          </svg>
        ))}
      </span>
      <span aria-hidden className="text-[14px] font-semibold leading-none text-[color:var(--text-muted)]">
        {String(rating).replace('.', ',')}
      </span>
    </span>
  )
}
