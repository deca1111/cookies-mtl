# Cookies MTL 🍪

La carte des cookies de Montréal — chaque cookie goûté, noté et localisé.
Prod : https://cookies-mtl.vercel.app

Stack : Next.js (App Router) · TypeScript · Tailwind CSS · MapLibre GL · Postgres (Neon). Déployé sur Vercel.

## Variables d'environnement

- `DATABASE_URL` — Postgres (Neon, provisionné via l'intégration Vercel)
- `ADMIN_PASSWORD` — mot de passe de `/admin`
- `ADMIN_SESSION_SECRET` — secret de signature du cookie de session admin
- `NEXT_PUBLIC_MAP_STYLE_URL_LIGHT` / `NEXT_PUBLIC_MAP_STYLE_URL_DARK` — optionnel, style MapLibre de secours si le fournisseur de tuiles par défaut (OpenFreeMap) tombe

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
