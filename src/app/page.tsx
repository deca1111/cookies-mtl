export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <span aria-hidden className="text-7xl">
        🍪
      </span>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Cookies MTL
      </h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        La carte des meilleurs cookies de Montréal arrive bientôt.
        <br />
        Montreal&apos;s best cookies, soon on a map.
      </p>
    </main>
  );
}
