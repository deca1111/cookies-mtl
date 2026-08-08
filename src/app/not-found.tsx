import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <span aria-hidden className="text-5xl">🍪</span>
      <p>Ce cookie n&apos;existe pas (encore). / This cookie doesn&apos;t exist (yet).</p>
      <Link href="/" className="underline">Voir la carte / See the map</Link>
    </main>
  )
}
