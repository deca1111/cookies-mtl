'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[color:var(--bg)] p-8 text-center">
      <span aria-hidden className="text-2xl opacity-40">
        🍪
      </span>
      <p className="font-serif max-w-sm text-[20px] leading-snug text-[color:var(--text-strong)]">
        Oups, quelque chose a brûlé au four. / Something burned in the oven.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-[color:var(--btn-bg)] px-5 py-2.5 text-[14px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)]"
      >
        Réessayer / Retry
      </button>
    </main>
  )
}
