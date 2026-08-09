import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[color:var(--bg)] p-8 text-center">
      <span aria-hidden className="opacity-40">
        <svg width="28" height="28" viewBox="0 0 300 300" aria-hidden="true">
          <use href="#cmtl-cookie-full" />
        </svg>
      </span>
      <p className="font-display max-w-sm text-[20px] leading-snug text-[color:var(--text-strong)]">
        Ce cookie n’existe pas (encore). / This cookie doesn’t exist (yet).
      </p>
      <Link
        href="/"
        className="text-[14px] text-[color:var(--accent-ink)] underline underline-offset-4 transition-colors hover:text-[color:var(--text-strong)]"
      >
        Voir la carte / See the map
      </Link>
    </main>
  )
}
