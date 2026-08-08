'use client'

export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      role="group"
      aria-label={`Note : ${String(value).replace('.', ',')} / 5`}
      className="flex gap-1.5 rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-3 py-2"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block h-10 w-10 select-none text-center text-[28px] leading-10">
          <span
            aria-hidden
            className={`inline-block transition-[opacity,transform] duration-150 ${
              value >= i ? 'scale-100 opacity-100' : value >= i - 0.5 ? 'scale-95 opacity-55' : 'scale-90 opacity-20'
            }`}
          >
            🍪
          </span>
          <button
            type="button"
            data-testid={`rating-${i}-half`}
            aria-label={`${i - 0.5} / 5`}
            onClick={() => onChange(i - 0.5)}
            className="absolute inset-y-0 left-0 w-1/2 rounded-l-md"
          />
          <button
            type="button"
            data-testid={`rating-${i}-full`}
            aria-label={`${i} / 5`}
            onClick={() => onChange(i)}
            className="absolute inset-y-0 right-0 w-1/2 rounded-r-md"
          />
        </span>
      ))}
    </div>
  )
}
