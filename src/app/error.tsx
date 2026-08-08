'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <span aria-hidden className="text-5xl">🍪</span>
      <p>Oups, quelque chose a brûlé au four. / Something burned in the oven.</p>
      <button onClick={reset} className="rounded-full bg-[color:var(--btn-bg)] px-5 py-2.5 text-[color:var(--btn-text)]">
        Réessayer / Retry
      </button>
    </main>
  )
}
