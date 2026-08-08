# Cookies MTL 🍪

La carte des cookies de Montréal — chaque cookie goûté, noté et localisé.
Prod : https://cookies-mtl.vercel.app

Stack : Next.js (App Router) · TypeScript · Tailwind CSS · MapLibre GL · Postgres (Neon). Déployé sur Vercel.

## Variables d'environnement

- `DATABASE_URL` — Postgres (Neon, provisionné via l'intégration Vercel)
- `ADMIN_PASSWORD` — mot de passe de `/admin`
- `ADMIN_SESSION_SECRET` — secret de signature du cookie de session admin
- `NEXT_PUBLIC_MAP_STYLE_URL_LIGHT` / `NEXT_PUBLIC_MAP_STYLE_URL_DARK` — optionnel, style MapLibre de secours si le fournisseur de tuiles par défaut (OpenFreeMap) tombe
- `NEXT_PUBLIC_TILES_BASE_URL` — URL du store Vercel Blob servant les tuiles pré-rendues du fallback raster
- `BLOB_READ_WRITE_TOKEN` — écriture sur le store Blob (uniquement pour `npm run tiles:render -- --upload`)

## Démarrage

```bash
npm install
vercel env pull .env.local --yes
npm run db:migrate
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

Les scripts `predev`/`prebuild` copient le worker MapLibre de `node_modules` vers `public/` (fichiers gitignorés — régénérés à chaque install/build, pas à committer).

## Tests

```bash
npm test
```

## Tuiles du fallback raster

Quand WebGL échoue chez un visiteur (bug WebKit iOS 18.x sur appareils A12, etc.), la
carte bascule automatiquement sur Leaflet + des tuiles **pré-rendues depuis notre
propre style** (même rendu visuel, zéro GPU), hébergées sur Vercel Blob. La bascule
est mémorisée (`localStorage.cmtl_renderer`) ; pour la forcer en dev :
`localStorage.setItem('cmtl_renderer','raster')` puis recharger.

Régénérer la pyramide (z11–16, thèmes clair + sombre, île de Montréal) **uniquement**
si la palette, le filtre de couches (`simplifyStyle`) ou le fond OSM changent :

```bash
vercel env pull .env.local --yes   # récupère BLOB_READ_WRITE_TOKEN
npm run tiles:render -- --upload   # ~15 min : rendu headless Chrome + upload Blob
```

Le CDN cache un an : en cas de changement visuel, bumper `PATH_VERSION` dans
`scripts/render-tiles.mjs` **et** l'URL correspondante dans `src/lib/tile-math.ts`
(chemin `tiles/v1/…`) avant de régénérer.
