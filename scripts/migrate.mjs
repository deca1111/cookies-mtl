// scripts/migrate.mjs — idempotent, run manually after schema changes
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const line = readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL missing from .env.local — run: vercel env pull .env.local --yes')
const sql = neon(line.slice('DATABASE_URL='.length).replace(/^"|"$/g, ''))

await sql`
  CREATE TABLE IF NOT EXISTS shops (
    id serial PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    google_maps_url text NOT NULL,
    rating numeric(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    review text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

// « En cours » = fiche de travail : elle vit en base et dans l'admin, mais reste
// hors de la carte, des fiches /c/[slug] et du sitemap tant qu'elle n'est pas
// validée. Le filtrage est fait par la couche data (listShops / getShopBySlug),
// pas au rendu, pour qu'une nouvelle page publique soit publique-sûre par défaut.
await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS in_progress boolean NOT NULL DEFAULT false`

console.log('migration ok')
