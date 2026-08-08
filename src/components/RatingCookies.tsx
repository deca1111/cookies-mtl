export function RatingCookies({ rating }: { rating: number }) {
  const label = `${String(rating).replace('.', ',')} / 5`
  const dots = Array.from({ length: 5 }, (_, i) => {
    if (rating >= i + 1) return '●'
    if (rating >= i + 0.5) return '◐'
    return '○'
  })
  return (
    <span aria-label={label} className="inline-flex items-baseline gap-2.5 text-[color:var(--accent)]">
      <span aria-hidden className="text-[13px] leading-none tracking-[0.22em]">{dots.join('')}</span>
      <span aria-hidden className="text-[14px] leading-none text-[color:var(--text-muted)]">
        {String(rating).replace('.', ',')}
      </span>
    </span>
  )
}
