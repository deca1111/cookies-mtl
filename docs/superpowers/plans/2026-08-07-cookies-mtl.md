# Cookies MTL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-page bilingual map of Montréal cookie shops with ratings/reviews, plus a password-protected mobile admin page, all free with no credit-card services.

**Architecture:** Next.js 16 App Router (existing repo) with Cache Components enabled. Public map at `/` (MapLibre GL + OpenFreeMap tiles, custom palette), deep links at `/c/[slug]` with OG images, admin at `/admin`. Data in Neon Postgres (Vercel Marketplace) accessed via small server-side lib modules; mutations via Server Actions with `updateTag`; place search proxied through a GET Route Handler to Photon (OpenStreetMap).

**Tech Stack:** Next.js 16.3 (`cacheComponents: true`), React 19, Tailwind 4, `maplibre-gl`, `@neondatabase/serverless` (raw SQL, no ORM), Vitest + Testing Library, Vercel Hobby.

**Spec:** `docs/superpowers/specs/2026-08-07-cookies-mtl-design.md` — the authority on product behavior.

## Global Constraints

- **Read the local Next.js docs before coding any Next.js API** — this version has breaking changes: `node_modules/next/dist/docs/01-app/` (already digested into this plan: params are Promises, typed `PageProps<'/route'>` / `LayoutProps<'/'>` / `RouteContext<'/route'>`, `use cache` + `cacheLife` + `cacheTag` + `updateTag`, components reading runtime APIs must sit under `<Suspense>`).
- **Free, no credit card, no Google account**: only OpenFreeMap tiles, Photon (`photon.komoot.io`), Neon free tier, Vercel Hobby. Never add a provider SDK requiring billing.
- **Rating**: 0–5, step 0.5. DB `numeric(2,1)` with CHECK; validation rejects anything else.
- **Montréal bounds guard**: lat ∈ [45.3, 45.8], lng ∈ [−74.1, −73.3].
- **Bilingual FR/EN**: every UI string goes through `src/lib/i18n.ts`; reviews displayed as written. French copy uses proper accents.
- **Visual direction** (from spec): light = crème `#f3ede3`/espresso `#3b2a1f`/caramel accents; dark = chocolate `#241a13`/gold `#d29a55`; refined pin markers, no raw emoji; ratings as ●●●●◐ + value.
- **Keep users on site**: share button shares `/c/[slug]`, never the Google listing.
- **The `AGENTS.md` block is re-added by `next dev`** — commit it with your work if it reappears; never fight it.
- Commits: conventional prefixes (`feat:`, `test:`, `chore:`, `docs:`). Run `npm test` before every commit that touches `src/`.
- All tests: Vitest, colocated under `src/**/__tests__/`. Run with `npx vitest run <path>`.

---

### Task 0: Vercel link + Neon provisioning + env

**Files:**
- Create: `.env.local` (via `vercel env pull` — never commit)
- Create: `scripts/migrate.mjs`
- Modify: `package.json` (add `db:migrate` script)

**Interfaces:**
- Produces: `DATABASE_URL` env var available locally and on Vercel; `shops` table exists.

- [ ] **Step 1: Install CLI and link project**

```bash
npm i -g vercel
vercel link
```

`vercel link` is interactive (login + project selection). **STOP and ask the user to complete the login/link prompts**, then continue.

- [ ] **Step 2: Provision Neon via Marketplace**

```bash
vercel integration add neon --yes --no-claim
```

If the CLI hands off to the browser/dashboard, run `vercel integration open neon`, **STOP and ask the user to finish there**, then continue. Free plan — if any step demands a credit card, STOP and report (spec has a Blob-JSON fallback decision to make with the user).

- [ ] **Step 3: Pull env vars**

```bash
vercel env pull .env.local --yes
grep -o "DATABASE_URL" .env.local
```

Expected: `DATABASE_URL` present. Never echo its value.

- [ ] **Step 4: Add admin secrets**

Generate and add two env vars (local + Vercel):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # run twice
vercel env add ADMIN_PASSWORD    # user-chosen password — STOP and ask the user to type it
vercel env add ADMIN_SESSION_SECRET   # paste first generated hex
vercel env pull .env.local --yes
```

- [ ] **Step 5: Write migration script**

```js
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
console.log('migration ok')
```

- [ ] **Step 6: Install driver, add script, run migration**

```bash
npm install @neondatabase/serverless
npm pkg set scripts.db:migrate="node scripts/migrate.mjs"
npm run db:migrate
```

Expected: `migration ok`.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate.mjs package.json package-lock.json
git commit -m "chore: provision Neon and add shops migration"
```

---

### Task 1: Vitest setup

**Files:**
- Create: `vitest.config.mts`, `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` runs Vitest once (CI mode); `npx vitest run` available to all later tasks.

- [ ] **Step 1: Install (per local Next.js vitest guide)**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

- [ ] **Step 2: Config**

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: { environment: 'jsdom' },
})
```

```bash
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 3: Smoke test**

```ts
// src/lib/__tests__/smoke.test.ts
import { expect, test } from 'vitest'

test('vitest runs', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 4: Run**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.mts src/lib/__tests__/smoke.test.ts package.json package-lock.json
git commit -m "chore: set up Vitest"
```

---

### Task 2: Slug generation

**Files:**
- Create: `src/lib/slug.ts`, `src/lib/__tests__/slug.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string`; `uniqueSlug(name: string, taken: Set<string>): string`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/__tests__/slug.test.ts
import { expect, test } from 'vitest'
import { slugify, uniqueSlug } from '../slug'

test('lowercases, strips accents and symbols', () => {
  expect(slugify('Félix & Norton')).toBe('felix-norton')
})

test('collapses whitespace and trims hyphens', () => {
  expect(slugify('  La   Fabrique — de Cookies!  ')).toBe('la-fabrique-de-cookies')
})

test('empty input falls back to "cookie"', () => {
  expect(slugify('!!!')).toBe('cookie')
})

test('uniqueSlug appends -2, -3 on collision', () => {
  const taken = new Set(['felix-norton', 'felix-norton-2'])
  expect(uniqueSlug('Félix & Norton', taken)).toBe('felix-norton-3')
  expect(uniqueSlug('Autre', taken)).toBe('autre')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/slug.test.ts`
Expected: FAIL — cannot resolve `../slug`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/slug.ts
export function slugify(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'cookie'
}

export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/slug.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/__tests__/slug.test.ts
git commit -m "feat: slug generation for shop share URLs"
```

---

### Task 3: Outbound link builders (directions, Google listing)

**Files:**
- Create: `src/lib/nav-links.ts`, `src/lib/__tests__/nav-links.test.ts`

**Interfaces:**
- Produces: `geoUri(lat, lng, name)`, `appleMapsUrl(lat, lng)`, `googleDirectionsUrl(lat, lng)`, `googleListingSearchUrl(name, address)` — all `(…): string`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/__tests__/nav-links.test.ts
import { expect, test } from 'vitest'
import { geoUri, appleMapsUrl, googleDirectionsUrl, googleListingSearchUrl } from '../nav-links'

test('geo URI embeds coords and encoded label', () => {
  expect(geoUri(45.5218, -73.5837, 'Félix & Norton')).toBe(
    'geo:45.5218,-73.5837?q=45.5218,-73.5837(F%C3%A9lix%20%26%20Norton)'
  )
})

test('apple maps directions', () => {
  expect(appleMapsUrl(45.5218, -73.5837)).toBe('https://maps.apple.com/?daddr=45.5218,-73.5837')
})

test('google maps directions', () => {
  expect(googleDirectionsUrl(45.5218, -73.5837)).toBe(
    'https://www.google.com/maps/dir/?api=1&destination=45.5218%2C-73.5837'
  )
})

test('google listing search from name + address', () => {
  expect(googleListingSearchUrl('Félix & Norton', '5252 Boul. Saint-Laurent, Montréal')).toBe(
    'https://www.google.com/maps/search/?api=1&query=F%C3%A9lix%20%26%20Norton%205252%20Boul.%20Saint-Laurent%2C%20Montr%C3%A9al'
  )
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/nav-links.test.ts`
Expected: FAIL — cannot resolve `../nav-links`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/nav-links.ts
export function geoUri(lat: number, lng: number, name: string): string {
  return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`
}

export function appleMapsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?daddr=${lat},${lng}`
}

export function googleDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
}

export function googleListingSearchUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/nav-links.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav-links.ts src/lib/__tests__/nav-links.test.ts
git commit -m "feat: outbound link builders for directions and Google listing"
```

---

### Task 4: Google Maps share-link parser (fallback ingestion)

**Files:**
- Create: `src/lib/google-link.ts`, `src/lib/__tests__/google-link.test.ts`

**Interfaces:**
- Produces:
  - `parseGoogleMapsUrl(finalUrl: string): { name: string; lat: number; lng: number } | null` (pure)
  - `resolveGoogleShareLink(shareUrl: string, fetchImpl?: typeof fetch): Promise<{ name: string; lat: number; lng: number; googleMapsUrl: string } | null>` — follows redirects, returns `null` on any failure (caller falls back to manual placement).

- [ ] **Step 1: Failing tests**

```ts
// src/lib/__tests__/google-link.test.ts
import { expect, test, vi } from 'vitest'
import { parseGoogleMapsUrl, resolveGoogleShareLink } from '../google-link'

const LONG_URL =
  'https://www.google.com/maps/place/F%C3%A9lix+%26+Norton/@45.5216,-73.586,17z/data=!3m1!4b1!4m6!3m5!1s0x4cc91bf8abc:0xdef!8m2!3d45.5218234!4d-73.5837119!16s'

test('parses name and precise !3d/!4d coords from long place URL', () => {
  expect(parseGoogleMapsUrl(LONG_URL)).toEqual({
    name: 'Félix & Norton',
    lat: 45.5218234,
    lng: -73.5837119,
  })
})

test('falls back to @lat,lng when !3d/!4d missing', () => {
  const url = 'https://www.google.com/maps/place/Cookie+Bar/@45.51,-73.57,17z/data=!4m2'
  expect(parseGoogleMapsUrl(url)).toEqual({ name: 'Cookie Bar', lat: 45.51, lng: -73.57 })
})

test('returns null on URLs without place segment or coords', () => {
  expect(parseGoogleMapsUrl('https://www.google.com/maps/@45.5,-73.6,12z')).toBeNull()
  expect(parseGoogleMapsUrl('https://example.com/nope')).toBeNull()
})

test('resolveGoogleShareLink follows redirect and keeps original share URL as listing link', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, url: LONG_URL })
  const out = await resolveGoogleShareLink('https://maps.app.goo.gl/AbC123', fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledWith('https://maps.app.goo.gl/AbC123', expect.objectContaining({ redirect: 'follow' }))
  expect(out).toEqual({
    name: 'Félix & Norton',
    lat: 45.5218234,
    lng: -73.5837119,
    googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  })
})

test('resolveGoogleShareLink rejects non-google hosts and network failures as null', async () => {
  expect(await resolveGoogleShareLink('https://evil.example/x')).toBeNull()
  const failing = vi.fn().mockRejectedValue(new Error('net'))
  expect(await resolveGoogleShareLink('https://maps.app.goo.gl/x', failing as unknown as typeof fetch)).toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/google-link.test.ts`
Expected: FAIL — cannot resolve `../google-link`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/google-link.ts
const SHARE_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com'])

export function parseGoogleMapsUrl(finalUrl: string): { name: string; lat: number; lng: number } | null {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return null
  }
  if (!url.hostname.endsWith('google.com')) return null

  const placeMatch = url.pathname.match(/\/place\/([^/]+)/)
  if (!placeMatch) return null
  const name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))

  // Precise pin: ...!3d<lat>!4d<lng> — preferred over @lat,lng (viewport center)
  const precise = finalUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (precise) return { name, lat: Number(precise[1]), lng: Number(precise[2]) }

  const viewport = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (viewport) return { name, lat: Number(viewport[1]), lng: Number(viewport[2]) }

  return null
}

export async function resolveGoogleShareLink(
  shareUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ name: string; lat: number; lng: number; googleMapsUrl: string } | null> {
  let host: string
  try {
    host = new URL(shareUrl).hostname
  } catch {
    return null
  }
  if (!SHARE_HOSTS.has(host)) return null

  try {
    const res = await fetchImpl(shareUrl, { redirect: 'follow' })
    const parsed = parseGoogleMapsUrl(res.url)
    if (!parsed) return null
    return { ...parsed, googleMapsUrl: shareUrl }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/google-link.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-link.ts src/lib/__tests__/google-link.test.ts
git commit -m "feat: Google Maps share-link parser for admin fallback"
```

---

### Task 5: Photon place search client

**Files:**
- Create: `src/lib/photon.ts`, `src/lib/__tests__/photon.test.ts`

**Interfaces:**
- Produces: `searchPlaces(q: string, fetchImpl?: typeof fetch): Promise<PlaceResult[]>` with `type PlaceResult = { name: string; address: string; lat: number; lng: number }`. Biased to Montréal, max 6 results, drops results outside the Montréal bounds.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/__tests__/photon.test.ts
import { expect, test, vi } from 'vitest'
import { searchPlaces } from '../photon'

function photonFeature(name: string, lat: number, lng: number, street?: string, city?: string) {
  return {
    geometry: { coordinates: [lng, lat] },
    properties: { name, street, housenumber: street ? '5252' : undefined, city },
  }
}

test('queries photon with Montréal bias and maps results', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [photonFeature('Félix & Norton', 45.5218, -73.5837, 'Boul. Saint-Laurent', 'Montréal')],
    }),
  })
  const results = await searchPlaces('félix', fetchMock as unknown as typeof fetch)

  const calledUrl = new URL(fetchMock.mock.calls[0][0] as string)
  expect(calledUrl.hostname).toBe('photon.komoot.io')
  expect(calledUrl.searchParams.get('q')).toBe('félix')
  expect(calledUrl.searchParams.get('lat')).toBe('45.5019')
  expect(calledUrl.searchParams.get('lon')).toBe('-73.5674')

  expect(results).toEqual([
    { name: 'Félix & Norton', address: '5252 Boul. Saint-Laurent, Montréal', lat: 45.5218, lng: -73.5837 },
  ])
})

test('drops results outside Montréal bounds and unnamed results', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [
        photonFeature('Paris Cookie', 48.85, 2.35),
        photonFeature('', 45.5, -73.6),
        photonFeature('Bon Cookie', 45.5, -73.6, undefined, 'Montréal'),
      ],
    }),
  })
  const results = await searchPlaces('cookie', fetchMock as unknown as typeof fetch)
  expect(results).toEqual([{ name: 'Bon Cookie', address: 'Montréal', lat: 45.5, lng: -73.6 }])
})

test('returns [] on network error or non-ok response', async () => {
  const failing = vi.fn().mockRejectedValue(new Error('net'))
  expect(await searchPlaces('x', failing as unknown as typeof fetch)).toEqual([])
  const notOk = vi.fn().mockResolvedValue({ ok: false })
  expect(await searchPlaces('x', notOk as unknown as typeof fetch)).toEqual([])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/photon.test.ts`
Expected: FAIL — cannot resolve `../photon`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/photon.ts
export type PlaceResult = { name: string; address: string; lat: number; lng: number }

export const MTL_BOUNDS = { latMin: 45.3, latMax: 45.8, lngMin: -74.1, lngMax: -73.3 }

export function withinMontreal(lat: number, lng: number): boolean {
  return lat >= MTL_BOUNDS.latMin && lat <= MTL_BOUNDS.latMax && lng >= MTL_BOUNDS.lngMin && lng <= MTL_BOUNDS.lngMax
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; housenumber?: string; street?: string; city?: string }
}

export async function searchPlaces(q: string, fetchImpl: typeof fetch = fetch): Promise<PlaceResult[]> {
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('lat', '45.5019')
  url.searchParams.set('lon', '-73.5674')
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'fr')

  try {
    const res = await fetchImpl(url.toString(), { headers: { 'User-Agent': 'cookies-mtl (personal project)' } })
    if (!res.ok) return []
    const data = (await res.json()) as { features?: PhotonFeature[] }
    return (data.features ?? [])
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const p = f.properties
        const address = [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.city]
          .filter(Boolean)
          .join(', ')
        return { name: p.name ?? '', address, lat, lng }
      })
      .filter((r) => r.name.length > 0 && withinMontreal(r.lat, r.lng))
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/photon.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photon.ts src/lib/__tests__/photon.test.ts
git commit -m "feat: Photon place search client with Montreal bias"
```

---

### Task 6: Shop input validation

**Files:**
- Create: `src/lib/validate.ts`, `src/lib/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: `withinMontreal` from `src/lib/photon.ts`.
- Produces: `type ShopInput = { name: string; address: string; lat: number; lng: number; googleMapsUrl: string; rating: number; review: string }`; `validateShopInput(raw: Record<string, unknown>): { ok: true; value: ShopInput } | { ok: false; error: string }`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/__tests__/validate.test.ts
import { expect, test } from 'vitest'
import { validateShopInput } from '../validate'

const good = {
  name: 'Félix & Norton',
  address: '5252 Boul. Saint-Laurent, Montréal',
  lat: 45.5218,
  lng: -73.5837,
  googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  rating: 4.5,
  review: 'Gooey parfait.',
}

test('accepts a valid input and trims strings', () => {
  const res = validateShopInput({ ...good, name: '  Félix & Norton  ' })
  expect(res).toEqual({ ok: true, value: good })
})

test('rejects ratings off the 0–5 half-step grid', () => {
  for (const rating of [-0.5, 5.5, 4.7, Number.NaN]) {
    expect(validateShopInput({ ...good, rating }).ok).toBe(false)
  }
  for (const rating of [0, 0.5, 5]) {
    expect(validateShopInput({ ...good, rating }).ok).toBe(true)
  }
})

test('rejects coordinates outside Montréal', () => {
  expect(validateShopInput({ ...good, lat: 48.85, lng: 2.35 }).ok).toBe(false)
})

test('rejects empty name and overlong fields', () => {
  expect(validateShopInput({ ...good, name: '  ' }).ok).toBe(false)
  expect(validateShopInput({ ...good, review: 'x'.repeat(2001) }).ok).toBe(false)
})

test('rejects non-https googleMapsUrl', () => {
  expect(validateShopInput({ ...good, googleMapsUrl: 'javascript:alert(1)' }).ok).toBe(false)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/validate.test.ts`
Expected: FAIL — cannot resolve `../validate`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/validate.ts
import { withinMontreal } from './photon'

export type ShopInput = {
  name: string
  address: string
  lat: number
  lng: number
  googleMapsUrl: string
  rating: number
  review: string
}

type Result = { ok: true; value: ShopInput } | { ok: false; error: string }

export function validateShopInput(raw: Record<string, unknown>): Result {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const address = typeof raw.address === 'string' ? raw.address.trim() : ''
  const review = typeof raw.review === 'string' ? raw.review.trim() : ''
  const googleMapsUrl = typeof raw.googleMapsUrl === 'string' ? raw.googleMapsUrl.trim() : ''
  const lat = Number(raw.lat)
  const lng = Number(raw.lng)
  const rating = Number(raw.rating)

  if (!name || name.length > 200) return { ok: false, error: 'name' }
  if (!address || address.length > 300) return { ok: false, error: 'address' }
  if (review.length > 2000) return { ok: false, error: 'review' }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !withinMontreal(lat, lng)) return { ok: false, error: 'position' }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5 || (rating * 2) % 1 !== 0) return { ok: false, error: 'rating' }
  try {
    if (new URL(googleMapsUrl).protocol !== 'https:') return { ok: false, error: 'googleMapsUrl' }
  } catch {
    return { ok: false, error: 'googleMapsUrl' }
  }

  return { ok: true, value: { name, address, lat, lng, googleMapsUrl, rating, review } }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/validate.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/__tests__/validate.test.ts
git commit -m "feat: shop input validation"
```

---

### Task 7: Data layer (Neon) + cached reads

**Files:**
- Create: `src/lib/db.ts`, `src/lib/shops.ts`
- Modify: `next.config.ts` (enable `cacheComponents`)

**Interfaces:**
- Consumes: `ShopInput` (Task 6), `uniqueSlug` (Task 2).
- Produces:
  - `type Shop = ShopInput & { id: number; slug: string }`
  - `listShops(): Promise<Shop[]>` — `'use cache'`, `cacheTag('shops')`, `cacheLife('max')`
  - `getShopBySlug(slug: string): Promise<Shop | null>` — same caching
  - `insertShop(input: ShopInput): Promise<Shop>`, `updateShop(id: number, input: ShopInput): Promise<void>`, `deleteShop(id: number): Promise<void>` — uncached, called only from Server Actions which then `updateTag('shops')`.

- [ ] **Step 1: Enable Cache Components**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
```

- [ ] **Step 2: DB client (lazy init — safe at build time, per vercel-storage guidance)**

```ts
// src/lib/db.ts
import { neon } from '@neondatabase/serverless'

let _sql: ReturnType<typeof neon> | null = null

export function getSql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!)
  return _sql
}
```

- [ ] **Step 3: Shops data module**

```ts
// src/lib/shops.ts
import { cacheLife, cacheTag } from 'next/cache'
import { getSql } from './db'
import { uniqueSlug } from './slug'
import type { ShopInput } from './validate'

export type Shop = ShopInput & { id: number; slug: string }

type Row = {
  id: number; slug: string; name: string; address: string
  lat: number; lng: number; google_maps_url: string; rating: string; review: string
}

function toShop(r: Row): Shop {
  return {
    id: r.id, slug: r.slug, name: r.name, address: r.address,
    lat: r.lat, lng: r.lng, googleMapsUrl: r.google_maps_url,
    rating: Number(r.rating), review: r.review,
  }
}

export async function listShops(): Promise<Shop[]> {
  'use cache'
  cacheLife('max')
  cacheTag('shops')
  const sql = getSql()
  const rows = (await sql`SELECT * FROM shops ORDER BY rating DESC, name ASC`) as Row[]
  return rows.map(toShop)
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  'use cache'
  cacheLife('max')
  cacheTag('shops')
  const sql = getSql()
  const rows = (await sql`SELECT * FROM shops WHERE slug = ${slug}`) as Row[]
  return rows[0] ? toShop(rows[0]) : null
}

export async function insertShop(input: ShopInput): Promise<Shop> {
  const sql = getSql()
  const existing = (await sql`SELECT slug FROM shops`) as { slug: string }[]
  const slug = uniqueSlug(input.name, new Set(existing.map((r) => r.slug)))
  const rows = (await sql`
    INSERT INTO shops (slug, name, address, lat, lng, google_maps_url, rating, review)
    VALUES (${slug}, ${input.name}, ${input.address}, ${input.lat}, ${input.lng},
            ${input.googleMapsUrl}, ${input.rating}, ${input.review})
    RETURNING *
  `) as Row[]
  return toShop(rows[0])
}

export async function updateShop(id: number, input: ShopInput): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE shops SET name = ${input.name}, address = ${input.address}, lat = ${input.lat},
      lng = ${input.lng}, google_maps_url = ${input.googleMapsUrl}, rating = ${input.rating},
      review = ${input.review}, updated_at = now()
    WHERE id = ${id}
  `
}

export async function deleteShop(id: number): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM shops WHERE id = ${id}`
}
```

- [ ] **Step 4: Round-trip smoke against real Neon**

```bash
node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const line = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('DATABASE_URL='));
const sql = neon(line.slice(13).replace(/^\"|\"$/g,''));
const [{count}] = await sql\`SELECT count(*)::int AS count FROM shops\`;
console.log('shops table reachable, rows:', count);
"
```

Expected: `shops table reachable, rows: 0`.

- [ ] **Step 5: Full test suite still green, then commit**

Run: `npm test`
Expected: all pass.

```bash
git add next.config.ts src/lib/db.ts src/lib/shops.ts
git commit -m "feat: Neon data layer with cached reads and cache tags"
```

---

### Task 8: Admin auth (password + signed session cookie)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/__tests__/auth.test.ts`, `src/app/actions/auth.ts`

**Interfaces:**
- Produces:
  - `signSession(expiresAtMs: number, secret: string): string` / `verifySessionToken(token: string, secret: string, nowMs: number): boolean` (pure, tested)
  - `isAdmin(): Promise<boolean>` — reads the `cmtl_admin` cookie via `cookies()`
  - `requireAdmin(): Promise<void>` — throws `Error('Unauthorized')` if not admin
  - Server Actions: `login(prevState, formData)` (sets cookie for 180 days on correct `ADMIN_PASSWORD`; returns `{ error: string } | undefined`), `logout()`.

- [ ] **Step 1: Failing tests (pure token logic)**

```ts
// src/lib/__tests__/auth.test.ts
import { expect, test } from 'vitest'
import { signSession, verifySessionToken } from '../auth'

const SECRET = 'test-secret'

test('sign/verify round-trip', () => {
  const token = signSession(Date.now() + 1000 * 60, SECRET)
  expect(verifySessionToken(token, SECRET, Date.now())).toBe(true)
})

test('rejects expired token', () => {
  const token = signSession(1000, SECRET)
  expect(verifySessionToken(token, SECRET, 2000)).toBe(false)
})

test('rejects tampered expiry and wrong secret', () => {
  const token = signSession(Date.now() + 1000 * 60, SECRET)
  const [, sig] = token.split('.')
  expect(verifySessionToken(`${Date.now() + 9999999}.${sig}`, SECRET, Date.now())).toBe(false)
  expect(verifySessionToken(token, 'other-secret', Date.now())).toBe(false)
})

test('rejects malformed tokens without throwing', () => {
  for (const bad of ['', 'nodot', 'a.b.c', '123.']) {
    expect(verifySessionToken(bad, SECRET, Date.now())).toBe(false)
  }
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: FAIL — cannot resolve `../auth`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/auth.ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'cmtl_admin'
export const SESSION_DAYS = 180

function hmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function signSession(expiresAtMs: number, secret: string): string {
  return `${expiresAtMs}.${hmac(String(expiresAtMs), secret)}`
}

export function verifySessionToken(token: string, secret: string, nowMs: number): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expiryStr, sig] = parts
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || expiry <= nowMs) return false
  const expected = hmac(expiryStr, secret)
  if (sig.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return false
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  return !!token && verifySessionToken(token, secret, Date.now())
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}
```

```ts
// src/app/actions/auth.ts
'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, SESSION_DAYS, signSession } from '@/lib/auth'

export async function login(_prev: { error: string } | undefined, formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const expected = process.env.ADMIN_PASSWORD ?? ''
  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  const match = expected.length > 0 && a.length === b.length && timingSafeEqual(a, b)
  if (!match) return { error: 'wrong-password' }

  const expiresAtMs = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, signSession(expiresAtMs, process.env.ADMIN_SESSION_SECRET!), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(expiresAtMs),
    path: '/',
  })
  return undefined
}

export async function logout() {
  ;(await cookies()).delete(ADMIN_COOKIE)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts src/app/actions/auth.ts
git commit -m "feat: admin password auth with signed session cookie"
```

---

### Task 9: Places search API route

**Files:**
- Create: `src/app/api/places/route.ts`, `src/app/api/places/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `searchPlaces` (Task 5), `isAdmin` (Task 8).
- Produces: `GET /api/places?q=<query>` → `200 {"results": PlaceResult[]}` for admins; `401` otherwise; `200 {"results": []}` for queries under 2 chars.

- [ ] **Step 1: Failing tests (call the handler directly; mock modules)**

```ts
// src/app/api/places/__tests__/route.test.ts
import { beforeEach, expect, test, vi } from 'vitest'

const isAdmin = vi.fn()
const searchPlaces = vi.fn()
vi.mock('@/lib/auth', () => ({ isAdmin: (...a: unknown[]) => isAdmin(...a) }))
vi.mock('@/lib/photon', () => ({ searchPlaces: (...a: unknown[]) => searchPlaces(...a) }))

import { GET } from '../route'

beforeEach(() => {
  isAdmin.mockReset().mockResolvedValue(true)
  searchPlaces.mockReset().mockResolvedValue([{ name: 'X', address: 'Y', lat: 45.5, lng: -73.6 }])
})

test('returns results for admin', async () => {
  const res = await GET(new Request('http://x/api/places?q=felix'))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ results: [{ name: 'X', address: 'Y', lat: 45.5, lng: -73.6 }] })
  expect(searchPlaces).toHaveBeenCalledWith('felix')
})

test('401 when not admin', async () => {
  isAdmin.mockResolvedValue(false)
  const res = await GET(new Request('http://x/api/places?q=felix'))
  expect(res.status).toBe(401)
})

test('short query returns empty without hitting Photon', async () => {
  const res = await GET(new Request('http://x/api/places?q=f'))
  expect(await res.json()).toEqual({ results: [] })
  expect(searchPlaces).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/api/places/__tests__/route.test.ts`
Expected: FAIL — cannot resolve `../route`.

- [ ] **Step 3: Implementation**

```ts
// src/app/api/places/route.ts
import { isAdmin } from '@/lib/auth'
import { searchPlaces } from '@/lib/photon'

export async function GET(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json({ results: [] })
  return Response.json({ results: await searchPlaces(q) })
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/api/places/__tests__/route.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/places
git commit -m "feat: admin-only place search API proxying Photon"
```

---

### Task 10: Shop CRUD Server Actions

**Files:**
- Create: `src/app/actions/shops.ts`, `src/app/actions/__tests__/shops.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (8), `validateShopInput` (6), `insertShop`/`updateShop`/`deleteShop` (7), `resolveGoogleShareLink` (4), `googleListingSearchUrl` (3), `updateTag` from `next/cache`.
- Produces (all `'use server'`, all guard with `requireAdmin` except noted):
  - `createShopAction(raw: Record<string, unknown>): Promise<{ ok: true; slug: string } | { ok: false; error: string }>` — if `raw.googleMapsUrl` is empty, builds it with `googleListingSearchUrl(name, address)`; calls `updateTag('shops')` on success.
  - `updateShopAction(id: number, raw: Record<string, unknown>)` / `deleteShopAction(id: number)` — same result shape, `updateTag('shops')`.
  - `resolveLinkAction(shareUrl: string): Promise<{ name: string; lat: number; lng: number; googleMapsUrl: string } | null>`.

- [ ] **Step 1: Failing tests**

```ts
// src/app/actions/__tests__/shops.test.ts
import { beforeEach, expect, test, vi } from 'vitest'

const requireAdmin = vi.fn()
const insertShop = vi.fn()
const updateShop = vi.fn()
const deleteShop = vi.fn()
const updateTag = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }))
vi.mock('@/lib/shops', () => ({
  insertShop: (...a: unknown[]) => insertShop(...a),
  updateShop: (...a: unknown[]) => updateShop(...a),
  deleteShop: (...a: unknown[]) => deleteShop(...a),
}))
vi.mock('next/cache', () => ({ updateTag: (...a: unknown[]) => updateTag(...a) }))

import { createShopAction, deleteShopAction } from '../shops'

const good = {
  name: 'Félix & Norton', address: '5252 Boul. Saint-Laurent, Montréal',
  lat: 45.5218, lng: -73.5837, googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  rating: 4.5, review: 'Gooey parfait.',
}

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined)
  insertShop.mockReset().mockResolvedValue({ ...good, id: 1, slug: 'felix-norton' })
  deleteShop.mockReset()
  updateTag.mockReset()
})

test('creates shop, revalidates tag, returns slug', async () => {
  const res = await createShopAction(good)
  expect(res).toEqual({ ok: true, slug: 'felix-norton' })
  expect(updateTag).toHaveBeenCalledWith('shops')
})

test('builds Google listing URL when none provided', async () => {
  await createShopAction({ ...good, googleMapsUrl: '' })
  const passed = insertShop.mock.calls[0][0]
  expect(passed.googleMapsUrl).toContain('https://www.google.com/maps/search/?api=1&query=')
})

test('returns validation error without touching db', async () => {
  const res = await createShopAction({ ...good, rating: 4.7 })
  expect(res).toEqual({ ok: false, error: 'rating' })
  expect(insertShop).not.toHaveBeenCalled()
  expect(updateTag).not.toHaveBeenCalled()
})

test('rejects when not admin', async () => {
  requireAdmin.mockRejectedValue(new Error('Unauthorized'))
  await expect(createShopAction(good)).rejects.toThrow('Unauthorized')
  await expect(deleteShopAction(1)).rejects.toThrow('Unauthorized')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/actions/__tests__/shops.test.ts`
Expected: FAIL — cannot resolve `../shops`.

- [ ] **Step 3: Implementation**

```ts
// src/app/actions/shops.ts
'use server'

import { updateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { resolveGoogleShareLink } from '@/lib/google-link'
import { googleListingSearchUrl } from '@/lib/nav-links'
import { deleteShop, insertShop, updateShop } from '@/lib/shops'
import { validateShopInput } from '@/lib/validate'

type ActionResult = { ok: true; slug: string } | { ok: false; error: string }

function withListingFallback(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.googleMapsUrl === 'string' && raw.googleMapsUrl.trim()) return raw
  return {
    ...raw,
    googleMapsUrl: googleListingSearchUrl(String(raw.name ?? ''), String(raw.address ?? '')),
  }
}

export async function createShopAction(raw: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin()
  const validated = validateShopInput(withListingFallback(raw))
  if (!validated.ok) return { ok: false, error: validated.error }
  const shop = await insertShop(validated.value)
  updateTag('shops')
  return { ok: true, slug: shop.slug }
}

export async function updateShopAction(id: number, raw: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin()
  const validated = validateShopInput(withListingFallback(raw))
  if (!validated.ok) return { ok: false, error: validated.error }
  await updateShop(id, validated.value)
  updateTag('shops')
  return { ok: true, slug: '' }
}

export async function deleteShopAction(id: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  await deleteShop(id)
  updateTag('shops')
  return { ok: true }
}

export async function resolveLinkAction(shareUrl: string) {
  await requireAdmin()
  return resolveGoogleShareLink(shareUrl)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/actions/__tests__/shops.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/shops.ts src/app/actions/__tests__/shops.test.ts
git commit -m "feat: shop CRUD server actions with tag revalidation"
```

---

### Task 11: i18n dictionary + provider

**Files:**
- Create: `src/lib/i18n.ts`, `src/lib/__tests__/i18n.test.ts`, `src/components/LangProvider.tsx`

**Interfaces:**
- Produces:
  - `type Lang = 'fr' | 'en'`; `dict: Record<Lang, Record<MsgKey, string>>` with `MsgKey` union covering every UI string.
  - `LangProvider` (client) + `useLang(): { lang: Lang; setLang: (l: Lang) => void; t: (k: MsgKey) => string }` — default from `navigator.language`, persisted in `localStorage('cmtl_lang')`.

- [ ] **Step 1: Failing test (dictionary completeness — both langs cover every key)**

```ts
// src/lib/__tests__/i18n.test.ts
import { expect, test } from 'vitest'
import { dict } from '../i18n'

test('fr and en have identical, non-empty key sets', () => {
  const frKeys = Object.keys(dict.fr).sort()
  const enKeys = Object.keys(dict.en).sort()
  expect(frKeys).toEqual(enKeys)
  expect(frKeys.length).toBeGreaterThan(0)
  for (const lang of ['fr', 'en'] as const) {
    for (const [k, v] of Object.entries(dict[lang])) {
      expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0)
    }
  }
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/i18n.test.ts`
Expected: FAIL — cannot resolve `../i18n`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/i18n.ts
export type Lang = 'fr' | 'en'

export const dict = {
  fr: {
    directions: 'Itinéraire',
    copyAddress: "Copier l'adresse",
    copied: 'Copié ✓',
    share: 'Partager',
    googleListing: 'Fiche Google',
    openInPlans: 'Ouvrir dans Plans',
    openInGoogleMaps: 'Ouvrir dans Google Maps',
    locateMe: 'Me localiser',
    mapUnavailable: 'La carte fait une pause cookie. Réessaie dans un instant !',
    linkCopied: 'Lien copié ✓',
    close: 'Fermer',
  },
  en: {
    directions: 'Directions',
    copyAddress: 'Copy address',
    copied: 'Copied ✓',
    share: 'Share',
    googleListing: 'Google listing',
    openInPlans: 'Open in Apple Maps',
    openInGoogleMaps: 'Open in Google Maps',
    locateMe: 'Locate me',
    mapUnavailable: 'The map is on a cookie break. Try again in a moment!',
    linkCopied: 'Link copied ✓',
    close: 'Close',
  },
} as const satisfies Record<Lang, Record<string, string>>

export type MsgKey = keyof (typeof dict)['fr']
```

(The admin page is FR-only — it has a single known user — so admin strings are written inline in French, not in this dictionary. Public-facing strings all live here; extend the key set as public UI tasks need them, keeping the completeness test green.)

```tsx
// src/components/LangProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dict, type Lang, type MsgKey } from '@/lib/i18n'

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: MsgKey) => string }>({
  lang: 'fr',
  setLang: () => {},
  t: (k) => dict.fr[k],
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const stored = localStorage.getItem('cmtl_lang')
    if (stored === 'fr' || stored === 'en') setLangState(stored)
    else if (navigator.language.toLowerCase().startsWith('en')) setLangState('en')
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('cmtl_lang', l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: (k) => dict[lang][k] }}>{children}</LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/i18n.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/lib/__tests__/i18n.test.ts src/components/LangProvider.tsx
git commit -m "feat: FR/EN dictionary and language provider"
```

---

### Task 12: Public map page (MapLibre + palette + bottom sheet)

**Files:**
- Create: `src/lib/map-style.ts`, `src/components/RatingCookies.tsx`, `src/components/ShopSheet.tsx`, `src/components/CookieMap.tsx`, `src/components/__tests__/rating.test.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `listShops`/`Shop` (7), nav-links (3), `useLang`/`LangProvider` (11).
- Produces:
  - `CookieMap({ shops, initialSlug }: { shops: Shop[]; initialSlug?: string })` — client component: full-screen map, pins, opens `ShopSheet` on pin tap; `initialSlug` opens that shop's sheet on load (used by Task 13).
  - `RatingCookies({ rating }: { rating: number })` — renders `●●●●◐ 4,5`-style display (`aria-label="4,5 / 5"`).
  - `getMapStyleUrl(theme: 'light' | 'dark'): string` reading `NEXT_PUBLIC_MAP_STYLE_URL_LIGHT/_DARK` with OpenFreeMap defaults, and `applyPalette(style, theme)` recoloring background/water/roads layers to the spec palette.

- [ ] **Step 1: Install MapLibre**

```bash
npm install maplibre-gl
```

- [ ] **Step 2: Failing test for rating display**

```tsx
// src/components/__tests__/rating.test.tsx
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RatingCookies } from '../RatingCookies'

test('renders full, half and empty dots with accessible label', () => {
  render(<RatingCookies rating={3.5} />)
  const el = screen.getByLabelText('3,5 / 5')
  expect(el.textContent).toContain('3,5')
})

test('renders 5/5 and 0/5 without crashing', () => {
  render(<RatingCookies rating={5} />)
  expect(screen.getByLabelText('5 / 5')).toBeDefined()
  render(<RatingCookies rating={0} />)
  expect(screen.getByLabelText('0 / 5')).toBeDefined()
})
```

Run: `npx vitest run src/components/__tests__/rating.test.tsx` — Expected: FAIL.

- [ ] **Step 3: RatingCookies implementation**

```tsx
// src/components/RatingCookies.tsx
export function RatingCookies({ rating }: { rating: number }) {
  const label = `${String(rating).replace('.', ',')} / 5`
  const dots = Array.from({ length: 5 }, (_, i) => {
    if (rating >= i + 1) return '●'
    if (rating >= i + 0.5) return '◐'
    return '○'
  })
  return (
    <span aria-label={label} className="inline-flex items-center gap-1.5 text-[color:var(--accent)]">
      <span aria-hidden className="tracking-[0.2em]">{dots.join('')}</span>
      <span aria-hidden className="text-sm text-[color:var(--text-muted)]">{String(rating).replace('.', ',')}</span>
    </span>
  )
}
```

Run: `npx vitest run src/components/__tests__/rating.test.tsx` — Expected: 2 passed.

- [ ] **Step 4: Map style helper**

```ts
// src/lib/map-style.ts
export type MapTheme = 'light' | 'dark'

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export function getMapStyleUrl(theme: MapTheme): string {
  const env = theme === 'dark' ? process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK : process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT
  return env || DEFAULT_STYLE
}

// Spec palette (docs/superpowers/specs/2026-08-07-cookies-mtl-design.md — Direction visuelle)
const PALETTES = {
  light: { background: '#f3ede3', water: '#d8d4c3', roads: '#faf6ee', parks: '#e4e6d4', text: '#6b5b49' },
  dark: { background: '#241a13', water: '#191410', roads: '#32251b', parks: '#27301f', text: '#a3958a' },
}

type StyleLayer = { id: string; type: string; paint?: Record<string, unknown> }

// Recolors a MapLibre style JSON in place-categories: background, water, roads, landuse, labels.
export function applyPalette<T extends { layers: StyleLayer[] }>(style: T, theme: MapTheme): T {
  const p = PALETTES[theme]
  for (const layer of style.layers) {
    layer.paint = layer.paint ?? {}
    if (layer.type === 'background') layer.paint['background-color'] = p.background
    else if (layer.id.includes('water') && layer.type === 'fill') layer.paint['fill-color'] = p.water
    else if (layer.type === 'line' && (layer.id.includes('road') || layer.id.includes('street') || layer.id.includes('highway')))
      layer.paint['line-color'] = p.roads
    else if (layer.type === 'fill' && (layer.id.includes('park') || layer.id.includes('grass') || layer.id.includes('wood')))
      layer.paint['fill-color'] = p.parks
    else if (layer.type === 'symbol') layer.paint['text-color'] = p.text
  }
  return style
}
```

- [ ] **Step 5: ShopSheet (bottom sheet with the four actions)**

```tsx
// src/components/ShopSheet.tsx
'use client'

import { useState } from 'react'
import type { Shop } from '@/lib/shops'
import { appleMapsUrl, geoUri, googleDirectionsUrl } from '@/lib/nav-links'
import { useLang } from './LangProvider'
import { RatingCookies } from './RatingCookies'

function platform(): 'android' | 'ios' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  if (/android/i.test(navigator.userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'desktop'
}

export function ShopSheet({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [iosChooser, setIosChooser] = useState(false)

  const shareUrl = `${window.location.origin}/c/${shop.slug}`

  const onDirections = () => {
    const p = platform()
    if (p === 'android') window.location.href = geoUri(shop.lat, shop.lng, shop.name)
    else if (p === 'ios') setIosChooser(true)
    else window.open(googleDirectionsUrl(shop.lat, shop.lng), '_blank', 'noopener')
  }

  const onCopy = async () => {
    await navigator.clipboard.writeText(shop.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.name, url: shareUrl })
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl bg-[color:var(--sheet-bg)] p-5 pb-8 shadow-[0_-6px_24px_rgba(0,0,0,0.15)]">
      <button aria-label={t('close')} onClick={onClose} className="absolute right-4 top-3 text-[color:var(--text-muted)]">
        ✕
      </button>
      <h2 className="font-serif text-xl text-[color:var(--text-strong)]">{shop.name}</h2>
      <RatingCookies rating={shop.rating} />
      {shop.review && <p className="mt-2 text-[color:var(--text-body)]">{shop.review}</p>}
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{shop.address}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={onDirections} className="rounded-full bg-[color:var(--btn-bg)] px-5 py-2.5 text-[color:var(--btn-text)]">
          {t('directions')}
        </button>
        <button onClick={onCopy} className="rounded-full border border-[color:var(--border)] px-5 py-2.5">
          {copied ? t('copied') : t('copyAddress')}
        </button>
        <button onClick={onShare} className="rounded-full border border-[color:var(--border)] px-5 py-2.5">
          {linkCopied ? t('linkCopied') : t('share')}
        </button>
        <a
          href={shop.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          {t('googleListing')} ↗
        </a>
      </div>

      {iosChooser && (
        <div className="mt-3 flex gap-2">
          <a href={appleMapsUrl(shop.lat, shop.lng)} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm">
            {t('openInPlans')}
          </a>
          <a href={googleDirectionsUrl(shop.lat, shop.lng)} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm">
            {t('openInGoogleMaps')}
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: CookieMap**

```tsx
// src/components/CookieMap.tsx
'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { getMapStyleUrl, applyPalette, type MapTheme } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { useLang } from './LangProvider'
import { ShopSheet } from './ShopSheet'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

function currentTheme(): MapTheme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function CookieMap({ shops, initialSlug }: { shops: Shop[]; initialSlug?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selected, setSelected] = useState<Shop | null>(
    initialSlug ? (shops.find((s) => s.slug === initialSlug) ?? null) : null
  )
  const [mapError, setMapError] = useState(false)
  const { t, lang, setLang } = useLang()

  useEffect(() => {
    if (!containerRef.current) return
    const theme = currentTheme()
    let cancelled = false

    async function init() {
      try {
        const res = await fetch(getMapStyleUrl(theme))
        if (!res.ok) throw new Error('style fetch failed')
        const style = applyPalette(await res.json(), theme)
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: selected ? [selected.lng, selected.lat] : MTL_CENTER,
          zoom: selected ? 15 : 12,
          attributionControl: { compact: true },
        })
        mapRef.current = map

        map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'bottom-right')

        for (const shop of shops) {
          const el = document.createElement('button')
          el.className = 'cmtl-pin'
          el.setAttribute('aria-label', shop.name)
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            setSelected(shop)
            map.easeTo({ center: [shop.lng, shop.lat] })
          })
          new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([shop.lng, shop.lat]).addTo(map)
        }
        map.on('click', () => setSelected(null))
      } catch {
        if (!cancelled) setMapError(true)
      }
    }
    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--bg)] p-8 text-center">
          <p>{t('mapUnavailable')}</p>
        </div>
      )}
      <button
        onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        className="absolute right-3 top-3 z-10 rounded-full bg-[color:var(--sheet-bg)] px-3 py-1.5 text-sm shadow"
        aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
      >
        {lang === 'fr' ? 'EN' : 'FR'}
      </button>
      {selected && <ShopSheet shop={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
```

- [ ] **Step 7: Page, layout, pin + theme CSS**

```tsx
// src/app/page.tsx
import { Suspense } from 'react'
import { CookieMap } from '@/components/CookieMap'
import { listShops } from '@/lib/shops'

export default function Home() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[color:var(--bg)]" />}>
      <MapWithShops />
    </Suspense>
  )
}

async function MapWithShops() {
  const shops = await listShops()
  return <CookieMap shops={shops} />
}
```

In `src/app/layout.tsx`, wrap `{children}` with `<LangProvider>` (import from `@/components/LangProvider`).

Append to `src/app/globals.css`:

```css
:root {
  --bg: #f3ede3;
  --sheet-bg: #fffdf9;
  --text-strong: #2c1f16;
  --text-body: #4a3b2d;
  --text-muted: #8a7a68;
  --accent: #a4794a;
  --border: #d9cfc0;
  --btn-bg: #3b2a1f;
  --btn-text: #f6efe4;
  --pin: #3b2a1f;
  --pin-ring: #faf6ee;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #241a13;
    --sheet-bg: #2e2118;
    --text-strong: #f2e7d8;
    --text-body: #d8c9b8;
    --text-muted: #a3958a;
    --accent: #d29a55;
    --border: #5a4936;
    --btn-bg: #d29a55;
    --btn-text: #241a13;
    --pin: #d29a55;
    --pin-ring: #241a13;
  }
}
.cmtl-pin {
  width: 26px;
  height: 26px;
  background: var(--pin);
  border: 2.5px solid var(--pin-ring);
  border-radius: 50% 50% 50% 4px;
  transform: rotate(45deg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
```

- [ ] **Step 8: Verify in browser**

```bash
npm run dev
```

Insert one row manually for the check:

```bash
node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const line = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('DATABASE_URL='));
const sql = neon(line.slice(13).replace(/^\"|\"$/g,''));
await sql\`INSERT INTO shops (slug,name,address,lat,lng,google_maps_url,rating,review)
  VALUES ('test-cookie','Test Cookie','123 Rue Test, Montréal',45.5219,-73.5837,'https://www.google.com/maps/search/?api=1&query=test',4.5,'Délicieux.')
  ON CONFLICT (slug) DO NOTHING\`;
console.log('seeded');
"
```

Open `http://localhost:3000`: map renders in crème palette, one pin visible, tap opens sheet with name/●●●●◐ 4,5/review/actions, FR⇄EN toggle switches button labels. Report any console errors; fix before committing. Then delete the seed row:

```bash
node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const line = readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('DATABASE_URL='));
const sql = neon(line.slice(13).replace(/^\"|\"$/g,''));
await sql\`DELETE FROM shops WHERE slug='test-cookie'\`;
console.log('cleaned');
"
```

- [ ] **Step 9: Full suite + commit**

Run: `npm test` — Expected: all pass.

```bash
git add src/components src/lib/map-style.ts src/app/page.tsx src/app/layout.tsx src/app/globals.css package.json package-lock.json AGENTS.md
git commit -m "feat: public map with MapLibre, cookie palette and shop bottom sheet"
```

---

### Task 13: Deep links `/c/[slug]` + OG image

**Files:**
- Create: `src/app/c/[slug]/page.tsx`, `src/app/c/[slug]/opengraph-image.tsx`

**Interfaces:**
- Consumes: `getShopBySlug`, `listShops` (7), `CookieMap` with `initialSlug` (12).
- Produces: shareable page rendering the map with the shop's sheet open; per-shop OG image (name + rating) for share previews.

- [ ] **Step 1: Page with generateMetadata**

```tsx
// src/app/c/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CookieMap } from '@/components/CookieMap'
import { getShopBySlug, listShops } from '@/lib/shops'

export async function generateMetadata({ params }: PageProps<'/c/[slug]'>) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  if (!shop) return { title: 'Cookies MTL' }
  return {
    title: `${shop.name} — Cookies MTL`,
    description: `${String(shop.rating).replace('.', ',')} / 5 · ${shop.review.slice(0, 140)}`,
  }
}

export default function ShopPage({ params }: PageProps<'/c/[slug]'>) {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[color:var(--bg)]" />}>
      <MapForShop params={params} />
    </Suspense>
  )
}

async function MapForShop({ params }: { params: PageProps<'/c/[slug]'>['params'] }) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  if (!shop) notFound()
  const shops = await listShops()
  return <CookieMap shops={shops} initialSlug={slug} />
}
```

- [ ] **Step 2: OG image**

```tsx
// src/app/c/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { getShopBySlug } from '@/lib/shops'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await getShopBySlug(slug)
  const name = shop?.name ?? 'Cookies MTL'
  const rating = shop ? `${String(shop.rating).replace('.', ',')} / 5` : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3ede3',
          color: '#2c1f16',
        }}
      >
        <div style={{ fontSize: 40, color: '#a4794a' }}>🍪 Cookies MTL</div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 24, textAlign: 'center', padding: '0 60px' }}>{name}</div>
        {rating && <div style={{ fontSize: 48, color: '#a4794a', marginTop: 24 }}>{rating}</div>}
      </div>
    ),
    size
  )
}
```

- [ ] **Step 3: Verify**

With dev server running and a seeded shop (reuse Task 12 seed): open `http://localhost:3000/c/test-cookie` → map opens with sheet already visible; `http://localhost:3000/c/test-cookie/opengraph-image` → PNG with name and rating; unknown slug → 404. Clean the seed afterwards.

- [ ] **Step 4: Full suite + commit**

Run: `npm test` — Expected: all pass.

```bash
git add src/app/c
git commit -m "feat: shop deep links with OG share images"
```

---

### Task 14: Admin page (login, guided add flow, list)

**Files:**
- Create: `src/app/admin/page.tsx`, `src/components/admin/LoginForm.tsx`, `src/components/admin/AdminApp.tsx`, `src/components/admin/PlaceSearch.tsx`, `src/components/admin/RatingInput.tsx`, `src/components/admin/__tests__/rating-input.test.tsx`

**Interfaces:**
- Consumes: `isAdmin` (8), `login` (8), CRUD actions + `resolveLinkAction` (10), `/api/places` (9), `Shop`/`listShops` (7), MapLibre.
- Produces: `/admin` — login form when logged out; when logged in: add form (search → confirm on mini-map → rate → review → save), shop list with edit/delete. Admin UI copy is French-only.

- [ ] **Step 1: Failing test for RatingInput (5 cookies, half-steps)**

```tsx
// src/components/admin/__tests__/rating-input.test.tsx
import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RatingInput } from '../RatingInput'

test('clicking right half of 4th cookie yields 4, left half yields 3.5', () => {
  const onChange = vi.fn()
  render(<RatingInput value={0} onChange={onChange} />)
  fireEvent.click(screen.getByTestId('rating-4-full'))
  expect(onChange).toHaveBeenCalledWith(4)
  fireEvent.click(screen.getByTestId('rating-4-half'))
  expect(onChange).toHaveBeenCalledWith(3.5)
})

test('renders current value accessibly', () => {
  render(<RatingInput value={2.5} onChange={() => {}} />)
  expect(screen.getByRole('group', { name: 'Note : 2,5 / 5' })).toBeDefined()
})
```

Run: `npx vitest run src/components/admin/__tests__/rating-input.test.tsx` — Expected: FAIL.

- [ ] **Step 2: RatingInput implementation**

```tsx
// src/components/admin/RatingInput.tsx
'use client'

export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="group" aria-label={`Note : ${String(value).replace('.', ',')} / 5`} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block h-10 w-10 select-none text-3xl leading-10">
          <span aria-hidden className={value >= i ? '' : value >= i - 0.5 ? 'opacity-60' : 'opacity-20'}>🍪</span>
          <button
            type="button"
            data-testid={`rating-${i}-half`}
            aria-label={`${i - 0.5} / 5`}
            onClick={() => onChange(i - 0.5)}
            className="absolute inset-y-0 left-0 w-1/2"
          />
          <button
            type="button"
            data-testid={`rating-${i}-full`}
            aria-label={`${i} / 5`}
            onClick={() => onChange(i)}
            className="absolute inset-y-0 right-0 w-1/2"
          />
        </span>
      ))}
    </div>
  )
}
```

Run: `npx vitest run src/components/admin/__tests__/rating-input.test.tsx` — Expected: 2 passed.

- [ ] **Step 3: Admin page shell (server) + login form**

```tsx
// src/app/admin/page.tsx
import { Suspense } from 'react'
import { isAdmin } from '@/lib/auth'
import { listShops } from '@/lib/shops'
import { AdminApp } from '@/components/admin/AdminApp'
import { LoginForm } from '@/components/admin/LoginForm'

export const metadata = { title: 'Admin — Cookies MTL', robots: { index: false, follow: false } }

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="p-6">Chargement…</main>}>
      <AdminGate />
    </Suspense>
  )
}

async function AdminGate() {
  if (!(await isAdmin())) return <LoginForm />
  const shops = await listShops()
  return <AdminApp shops={shops} />
}
```

```tsx
// src/components/admin/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="font-serif text-2xl">🍪 Admin Cookies MTL</h1>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          autoFocus
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--sheet-bg)] px-4 py-3"
        />
        <button disabled={pending} className="rounded-xl bg-[color:var(--btn-bg)] px-4 py-3 text-[color:var(--btn-text)]">
          {pending ? '…' : 'Entrer'}
        </button>
        {state?.error && <p className="text-sm text-red-600">Mot de passe incorrect.</p>}
      </form>
    </main>
  )
}
```

- [ ] **Step 4: PlaceSearch (debounced autocomplete + both fallbacks)**

```tsx
// src/components/admin/PlaceSearch.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveLinkAction } from '@/app/actions/shops'
import type { PlaceResult } from '@/lib/photon'

export type PickedPlace = { name: string; address: string; lat: number; lng: number; googleMapsUrl: string }

// Three paths to a PickedPlace, in order of friction:
// 1. type → Photon suggestions → tap
// 2. "Je ne trouve pas" → paste a Google Maps share link
// 3. manual: type the name, place the pin on the mini-map (handled by parent via onManualRequest)
export function PlaceSearch({
  onPick,
  onManualRequest,
}: {
  onPick: (p: PickedPlace) => void
  onManualRequest: (typedName: string) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [mode, setMode] = useState<'search' | 'link'>('search')
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults((await res.json()).results)
      } catch {
        setResults([])
      }
    }, 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q])

  const submitLink = async () => {
    setBusy(true)
    setLinkError(false)
    const resolved = await resolveLinkAction(link.trim())
    setBusy(false)
    if (!resolved) {
      setLinkError(true)
      return
    }
    onPick({ ...resolved, address: '' })
  }

  if (mode === 'link') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[color:var(--text-muted)]">
          Dans Google Maps : Partager → Copier le lien, puis colle-le ici.
        </p>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://maps.app.goo.gl/…"
          className="rounded-xl border border-[color:var(--border)] px-4 py-3"
        />
        <div className="flex gap-2">
          <button type="button" onClick={submitLink} disabled={busy} className="rounded-xl bg-[color:var(--btn-bg)] px-4 py-2 text-[color:var(--btn-text)]">
            {busy ? '…' : 'Utiliser ce lien'}
          </button>
          <button type="button" onClick={() => setMode('search')} className="px-3 text-sm underline">
            Retour à la recherche
          </button>
        </div>
        {linkError && (
          <p className="text-sm text-red-600">
            Lien illisible. <button type="button" className="underline" onClick={() => onManualRequest(q)}>Placer le point à la main</button>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nom du magasin…"
        autoFocus
        className="rounded-xl border border-[color:var(--border)] px-4 py-3"
      />
      {results.length > 0 && (
        <ul className="divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)]">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick({ ...r, googleMapsUrl: '' })}
                className="w-full px-4 py-3 text-left"
              >
                <span className="block">{r.name}</span>
                <span className="block text-sm text-[color:var(--text-muted)]">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && (
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => setMode('link')} className="underline">
            Je ne trouve pas — coller un lien Google Maps
          </button>
          <button type="button" onClick={() => onManualRequest(q)} className="underline">
            Placer à la main
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: AdminApp (flow assembly + list + edit/delete + mini-map)**

```tsx
// src/components/admin/AdminApp.tsx
'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { logout } from '@/app/actions/auth'
import { createShopAction, deleteShopAction, updateShopAction } from '@/app/actions/shops'
import { getMapStyleUrl } from '@/lib/map-style'
import type { Shop } from '@/lib/shops'
import { PlaceSearch, type PickedPlace } from './PlaceSearch'
import { RatingInput } from './RatingInput'

const MTL_CENTER: [number, number] = [-73.5674, 45.5019]

type Draft = PickedPlace & { rating: number; review: string; id?: number }

export function AdminApp({ shops }: { shops: Shop[] }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [manualName, setManualName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mapDiv = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  // Mini confirmation map with a draggable pin, shown whenever a draft has coords
  useEffect(() => {
    if (!draft || !mapDiv.current) return
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: getMapStyleUrl('light'),
      center: [draft.lng, draft.lat],
      zoom: 16,
      attributionControl: { compact: true },
    })
    const marker = new maplibregl.Marker({ draggable: true }).setLngLat([draft.lng, draft.lat]).addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      setDraft((d) => (d ? { ...d, lat, lng } : d))
    })
    markerRef.current = marker
    return () => {
      map.remove()
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.lat === undefined, draft?.name])

  const startManual = (typedName: string) => {
    setManualName(typedName)
    setDraft({ name: typedName, address: '', lat: MTL_CENTER[1], lng: MTL_CENTER[0], googleMapsUrl: '', rating: 0, review: '' })
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setError(null)
    const payload = { ...draft }
    const res = draft.id ? await updateShopAction(draft.id, payload) : await createShopAction(payload)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDraft(null)
    setManualName(null)
  }

  const remove = async (shop: Shop) => {
    if (!window.confirm(`Supprimer « ${shop.name} » ?`)) return
    await deleteShopAction(shop.id)
  }

  const errorLabels: Record<string, string> = {
    name: 'Le nom est requis.',
    address: "L'adresse est requise.",
    position: 'La position doit être à Montréal.',
    rating: 'Choisis une note (0 à 5, par demi-cookie).',
    googleMapsUrl: 'Le lien Google est invalide.',
    review: "L'avis est trop long.",
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-5 pb-16">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">🍪 Admin</h1>
        <button onClick={() => logout()} className="text-sm text-[color:var(--text-muted)] underline">
          Se déconnecter
        </button>
      </header>

      {!draft && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Ajouter un cookie</h2>
          <PlaceSearch onPick={(p) => setDraft({ ...p, rating: 0, review: '' })} onManualRequest={startManual} />
        </section>
      )}

      {draft && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg">{draft.id ? 'Modifier' : 'C’est bien ici ?'}</h2>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nom du magasin"
            className="rounded-xl border border-[color:var(--border)] px-4 py-3"
          />
          <input
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            placeholder="Adresse"
            className="rounded-xl border border-[color:var(--border)] px-4 py-3"
          />
          <div ref={mapDiv} className="h-52 w-full overflow-hidden rounded-xl border border-[color:var(--border)]" />
          <details>
            <summary className="cursor-pointer text-sm text-[color:var(--text-muted)]">Lien fiche Google (avancé)</summary>
            <input
              value={draft.googleMapsUrl}
              onChange={(e) => setDraft({ ...draft, googleMapsUrl: e.target.value })}
              placeholder="Auto si vide"
              className="mt-2 w-full rounded-xl border border-[color:var(--border)] px-4 py-3"
            />
          </details>
          {manualName !== null && (
            <p className="text-sm text-[color:var(--text-muted)]">Glisse le point sur le magasin.</p>
          )}
          <RatingInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
          <textarea
            value={draft.review}
            onChange={(e) => setDraft({ ...draft, review: e.target.value })}
            placeholder="Ton avis…"
            rows={3}
            className="rounded-xl border border-[color:var(--border)] px-4 py-3"
          />
          {error && <p className="text-sm text-red-600">{errorLabels[error] ?? 'Erreur — réessaie.'}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="rounded-xl bg-[color:var(--btn-bg)] px-5 py-3 text-[color:var(--btn-text)]">
              {saving ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => { setDraft(null); setManualName(null); setError(null) }} className="px-3 underline">
              Annuler
            </button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Les cookies ({shops.length})</h2>
        <ul className="divide-y divide-[color:var(--border)]">
          {shops.map((shop) => (
            <li key={shop.id} className="flex items-center justify-between py-3">
              <div>
                <span className="block">{shop.name}</span>
                <span className="text-sm text-[color:var(--text-muted)]">{String(shop.rating).replace('.', ',')} / 5</span>
              </div>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setDraft({ ...shop, id: shop.id })} className="underline">Modifier</button>
                <button onClick={() => remove(shop)} className="text-red-700 underline">Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
```

> Note: after a successful Server Action with `updateTag('shops')`, Next.js re-renders the page so `AdminApp` receives fresh `shops` props and `AdminGate` re-reads the DB. The `window.confirm` in `remove` runs in the user's real browser — fine in production, but never trigger it via browser automation (it blocks the tab).

- [ ] **Step 6: Verify the full flow in browser**

`npm run dev`, open `http://localhost:3000/admin` on desktop:
1. Wrong password → « Mot de passe incorrect » ; correct → admin visible; reload keeps session.
2. Search « cookie » → suggestions appear (needs network); pick one → mini-map with draggable pin; rate 4.5 via cookies; review; save → shop appears in list AND on `/`.
3. « Je ne trouve pas » → paste a real Google Maps share link → resolves name/coords.
4. « Placer à la main » → pin at center, drag, name typed manually, save.
5. Modifier → change rating → save; Supprimer → confirm → gone from list and map.

- [ ] **Step 7: Full suite + commit**

Run: `npm test` — Expected: all pass.

```bash
git add src/app/admin src/components/admin
git commit -m "feat: admin page with guided add flow, list, edit and delete"
```

---

### Task 15: PWA manifest, robots, error pages

**Files:**
- Create: `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/error.tsx`, `src/app/not-found.tsx`

**Interfaces:**
- Produces: installable app metadata; `/admin` excluded from indexing; friendly error/404 pages.

- [ ] **Step 1: Manifest + robots**

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cookies MTL',
    short_name: 'Cookies MTL',
    description: 'La carte des cookies de Montréal',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3ede3',
    theme_color: '#3b2a1f',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  }
}
```

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
  }
}
```

- [ ] **Step 2: Error + 404 pages**

```tsx
// src/app/error.tsx
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
```

```tsx
// src/app/not-found.tsx
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
```

- [ ] **Step 3: Verify + commit**

`npm run dev`: `http://localhost:3000/robots.txt` disallows `/admin`; `/manifest.webmanifest` serves JSON; unknown route shows 404 page. Run `npm test` — all pass.

```bash
git add src/app/manifest.ts src/app/robots.ts src/app/error.tsx src/app/not-found.tsx
git commit -m "feat: manifest, robots and friendly error pages"
```

---

### Task 16: Visual design pass

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/**` (styling only), `src/lib/map-style.ts` (palette tuning)

This task is judgment work, not mechanical: **invoke the `frontend-design` skill** and refine the UI against the spec's Direction visuelle (crème/espresso light, Moka nuit dark, serif elegante for headings — load a font like Fraunces via `next/font/google` in `layout.tsx`, applied via a `--font-serif` variable). Constraints: keep every existing test green; do not change component logic or interfaces; both themes must be checked (OS-level toggle); map palette (`applyPalette`) tuned so labels stay readable in both themes.

- [ ] **Step 1: Invoke frontend-design skill and restyle public page (map, sheet, toggle, pins)**
- [ ] **Step 2: Restyle admin (form, rating cookies, list) — keep it « ludique mais classe »**
- [ ] **Step 3: Check dark mode end-to-end (page, sheet, map palette, admin)**
- [ ] **Step 4: `npm test` green, visual review in browser at 390px width (iPhone) and desktop**
- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat: visual design pass — creme/espresso light, moka dark"
```

---

### Task 17: Build, deploy, real-device QA

**Files:**
- None new (fixes as needed).

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; fix any Cache Components validation insights it reports (missing Suspense, uncached data) per the local docs before proceeding.

- [ ] **Step 2: Deploy preview**

```bash
vercel deploy
```

Verify on the preview URL: map loads, `/c/<slug>` works, OG preview renders (paste link in a chat app), admin login + add flow works over HTTPS.

- [ ] **Step 3: Real phone QA (the spec's manual checklist)**

On a real phone (both platforms if available):
- Map pans smoothly; pins tappable; sheet opens.
- **Itinéraire**: Android → system app chooser via `geo:`; iOS → Plans/Google Maps mini-choice; links open the right app.
- **Copier l'adresse** → clipboard toast; **Partager** → native share sheet with `/c/[slug]` URL; **Fiche Google** opens listing.
- FR/EN toggle persists after reload.
- `/admin` on the phone: login, add to home screen, full add flow with Photon search.

- [ ] **Step 4: Production**

```bash
vercel deploy --prod
```

- [ ] **Step 5: Final commit & tag**

```bash
git add -A
git commit -m "chore: production fixes from device QA" --allow-empty
git tag v1.0.0
```

---

## Out of scope (per spec)

Photos (Vercel Blob), messaging-bot ingestion (Telegram), list view, tasting history, Google Places API. Do not implement any of these.
