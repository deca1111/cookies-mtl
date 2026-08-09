// scripts/copy-maplibre-worker.mjs — keeps the maplibre-gl worker files in public/ in sync
// with the installed maplibre-gl version.
//
// Why: maplibre-gl 6.x is ESM-only and locates its tile worker at runtime via
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Under Turbopack, the bundled
// `import.meta.url` for that module does not resolve to an http(s) URL, so maplibre-gl's
// internal detection falls back to an empty string and `new Worker("", {type:"module"})`
// throws — no tiles ever load. See src/lib/maplibre-setup.ts, which points maplibre-gl at
// this static, same-origin copy instead via `setWorkerUrl()`.
//
// Two files are needed: `maplibre-gl-worker.mjs` (the worker entry, copied as
// maplibre-gl-worker.js — the name setWorkerUrl() points at) statically
// `import`s a second chunk via the *relative* specifier `./maplibre-gl-shared.mjs`, which
// the browser resolves against the worker script's own URL — so that file must be copied
// unrenamed, alongside it, at the same public/ root.
//
// Run automatically via the `predev`/`prebuild` npm scripts so a `maplibre-gl` version bump
// (and its worker files) stays in sync without a manual step.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const distDir = join(root, 'node_modules', 'maplibre-gl', 'dist')
const destDir = join(root, 'public')

const files = [
  { src: 'maplibre-gl-worker.mjs', dest: 'maplibre-gl-worker.js' },
  // Filename must match exactly: maplibre-gl-worker.mjs imports it via the relative
  // specifier `./maplibre-gl-shared.mjs`, resolved by the browser at runtime.
  { src: 'maplibre-gl-shared.mjs', dest: 'maplibre-gl-shared.mjs' },
  // Sourcemaps: both files end with `//# sourceMappingURL=…` — without these copies,
  // devtools request them and log a 404 in the dev server (harmless but noisy).
  { src: 'maplibre-gl-worker.mjs.map', dest: 'maplibre-gl-worker.mjs.map', optional: true },
  { src: 'maplibre-gl-shared.mjs.map', dest: 'maplibre-gl-shared.mjs.map', optional: true },
]

mkdirSync(destDir, { recursive: true })
for (const { src, dest, optional } of files) {
  const srcPath = join(distDir, src)
  if (!existsSync(srcPath)) {
    if (optional) {
      console.warn(`[copy-maplibre-worker] optional source missing, skipped: ${src}`)
      continue
    }
    console.error(`[copy-maplibre-worker] source not found: ${srcPath} — maplibre-gl dist layout changed — update scripts/copy-maplibre-worker.mjs`)
    process.exit(1)
  }
  copyFileSync(srcPath, join(destDir, dest))
  console.log(`[copy-maplibre-worker] copied ${src} -> public/${dest}`)
}
