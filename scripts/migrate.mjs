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

// Le slug suit désormais le nom (spec 2026-08-11 §3) : renommer une fiche change
// son URL publique. Les anciens slugs sont gardés ici pour que /c/<ancien> réponde
// par une redirection permanente au lieu d'un 404 — les liens déjà partagés et ce
// que Google a indexé continuent de résoudre.
await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS previous_slugs text[] NOT NULL DEFAULT '{}'`

// Concours de cookies (spec 2026-09-25). Tout descend de `contests` en cascade :
// supprimer un concours efface invités, assiettes, auteurs et bulletins.
await sql`
  CREATE TABLE IF NOT EXISTS contests (
    id serial PRIMARY KEY,
    name text NOT NULL,
    secret text UNIQUE NOT NULL,
    phase text NOT NULL DEFAULT 'preparation'
      CHECK (phase IN ('preparation', 'voting', 'closed', 'reveal')),
    reveal_step int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`
await sql`
  CREATE TABLE IF NOT EXISTS contest_guests (
    id serial PRIMARY KEY,
    contest_id int NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    name text NOT NULL,
    claim_token text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`
// « Julie » et « julie » sont la même personne dans la liste de choix.
await sql`CREATE UNIQUE INDEX IF NOT EXISTS contest_guests_name_uniq ON contest_guests (contest_id, lower(name))`
// DEFERRABLE : le mélange des numéros permute des valeurs en une requête ; un
// contrôle immédiat, ligne par ligne, heurterait un doublon transitoire.
await sql`
  CREATE TABLE IF NOT EXISTS contest_plates (
    id serial PRIMARY KEY,
    contest_id int NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    number int NOT NULL CHECK (number > 0),
    label text,
    CONSTRAINT contest_plates_number_uniq UNIQUE (contest_id, number) DEFERRABLE INITIALLY DEFERRED
  )
`
await sql`
  CREATE TABLE IF NOT EXISTS contest_plate_authors (
    plate_id int NOT NULL REFERENCES contest_plates(id) ON DELETE CASCADE,
    guest_id int NOT NULL REFERENCES contest_guests(id) ON DELETE CASCADE,
    PRIMARY KEY (plate_id, guest_id)
  )
`
// Les rangs ne sont jamais recompactés en base : un bulletin se lit ORDER BY rank,
// et une assiette supprimée (cascade) laisse simplement un trou que la lecture ignore.
await sql`
  CREATE TABLE IF NOT EXISTS contest_ballots (
    guest_id int NOT NULL REFERENCES contest_guests(id) ON DELETE CASCADE,
    plate_id int NOT NULL REFERENCES contest_plates(id) ON DELETE CASCADE,
    rank int NOT NULL CHECK (rank > 0),
    PRIMARY KEY (guest_id, plate_id),
    CONSTRAINT contest_ballots_rank_uniq UNIQUE (guest_id, rank) DEFERRABLE INITIALLY DEFERRED
  )
`

// Mode de vote (retours d'UAT) : seuls les K premiers de chaque bulletin
// rapportent des points. NULL = « tout » (K = nombre de cookies). Défaut 5 :
// la bonne échelle pour une vingtaine de cookies.
await sql`ALTER TABLE contests ADD COLUMN IF NOT EXISTS top_k int DEFAULT 5 CHECK (top_k IS NULL OR top_k >= 1)`

console.log('migration ok')
