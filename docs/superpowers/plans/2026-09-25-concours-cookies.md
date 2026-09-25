# Concours de cookies (PR 1 — le cœur) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un concours de cookies à l'aveugle complet et fonctionnel (admin laptop, parcours invité téléphone bilingue, calcul, scène de révélation sobre), non indexé.

**Architecture:** Données dans 5 nouvelles tables Neon (migration idempotente existante). Logique métier en fonctions pures (`src/lib/contest-*.ts`) testées unitairement ; une couche data (`contest-db.ts`) et des « vues » serveur (`contest-views.ts`) qui assemblent l'état envoyé aux clients ; mutations en server actions ; synchronisation par polling de deux routes `etat`. UI en composants client sous `src/components/contest/` (invité) et `src/components/admin/contest/` (admin + scène).

**Tech Stack:** Next.js 16.3 (App Router, `cacheComponents: true`), React 19.2, Neon serverless (`getSql()`), Tailwind 4 + tokens CSS du projet, Vitest + Testing Library (jsdom), `@dnd-kit/core` + `@dnd-kit/sortable`, `qrcode`.

**Spec :** `docs/superpowers/specs/2026-09-25-concours-cookies-design.md` — à lire avant toute tâche.

## Global Constraints

- Branche : `feature/concours-cookies`. Ne jamais pousser sans l'accord de Léo. PR vers `main` à la fin.
- Lire la doc Next locale (`node_modules/next/dist/docs/`) avant d'utiliser une API Next inconnue (AGENTS.md).
- `cacheComponents: true` : tout accès à `cookies()`, `headers()` ou à la base non caché doit être dans un composant enveloppé de `<Suspense>` (modèle : `src/app/admin/page.tsx`). Les données concours ne sont **jamais** cachées (`'use cache'` interdit dans `contest-db.ts`).
- Après avoir créé une nouvelle route, lancer `npx next typegen` si `tsc` refuse `PageProps<'/…'>`.
- Tout texte invité passe par `src/lib/contest-i18n.ts` (FR + EN). Admin en français, en dur.
- Jamais d'emoji dans l'interface ; icônes SVG en trait (`src/components/icons.tsx`). Le « ✓ » est interdit aussi : utiliser `IconCheck`.
- Couleurs via les tokens CSS (`var(--surface)`, `var(--text-strong)`, `var(--btn-bg)`, `var(--danger)`, `var(--radius-card)`…), comme les composants admin existants.
- Pages concours et API concours : `noindex, nofollow` + `Cache-Control: no-store` sur les réponses d'état.
- L'état invité ne contient **jamais** les auteurs ni les scores tant que la scène n'a pas atteint son écran final.
- Polling : 2 500 ms, suspendu onglet caché.
- Commentaires en français, denses sur le *pourquoi*, comme le reste du code.
- Commandes : `npm test` (vitest run), `npx tsc --noEmit`, `npm run lint`.

---

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/contest-scoring.ts` | Calcul pur : scores normalisés, positions, stats, accord Spearman |
| `src/lib/contest-rules.ts` | Règles pures : phases, validation de bulletin, noms, labels, numéros, mélange |
| `src/lib/contest-reveal.ts` | Séquence pure des étapes de révélation |
| `src/lib/contest-ranking.ts` | Opérations pures sur le classement d'un invité (placer, retirer, déplacer) |
| `src/lib/contest-i18n.ts` | Dictionnaire FR/EN du parcours invité + `fmt` |
| `src/lib/contest-state.ts` | Construction pure des vues invité et admin à partir des données |
| `scripts/migrate.mjs` | + 5 tables |
| `src/lib/contest-db.ts` | Accès base (serveur) |
| `src/lib/contest-identity.ts` | Secrets, jetons, cookie d'appareil (serveur) |
| `src/lib/contest-views.ts` | Assemble db + identité + state (serveur), partagé pages/API |
| `src/app/actions/contest-admin.ts` | Server actions admin |
| `src/app/actions/contest-guest.ts` | Server actions invité |
| `src/app/api/concours/[secret]/etat/route.ts` | État invité (polling) |
| `src/app/api/admin/concours/[id]/etat/route.ts` | État admin + scène (polling) |
| `src/app/robots.ts`, `next.config.ts`, `src/app/concours/layout.tsx` | Non-indexation |
| `src/app/concours/[secret]/page.tsx` | Page invité |
| `src/components/contest/*` | UI invité |
| `src/app/admin/concours/**` | Pages admin + scène |
| `src/components/admin/contest/*` | UI admin + scène |
| `src/components/admin/AdminHeader.tsx` | + lien « Concours » |

---

### Task 1: Calcul des résultats (`contest-scoring.ts`)

**Files:**
- Create: `src/lib/contest-scoring.ts`
- Test: `src/lib/__tests__/contest-scoring.test.ts`

**Interfaces:**
- Produces:
  - `type PlateRef = { id: number; number: number }`
  - `type Ballot = { guestId: number; plateIds: number[] }` (ordonné, meilleur en premier)
  - `type PlateResult = { plateId: number; position: number | null; score: number | null; avgRank: number | null; votes: number; bestRank: number | null; worstRank: number | null; firsts: number }` (`score` ∈ [0,1])
  - `computeResults(plates: PlateRef[], ballots: Ballot[]): PlateResult[]` — trié, classement final
  - `agreement(ballot: number[], finalOrder: number[]): number | null` — pourcentage 0–100 entier

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/contest-scoring.test.ts
import { expect, test } from 'vitest'
import { agreement, computeResults } from '../contest-scoring'

const A = { id: 10, number: 1 }
const B = { id: 20, number: 2 }
const C = { id: 30, number: 3 }
const D = { id: 40, number: 4 }

test('score normalisé, rang moyen, stats et ordre final', () => {
  const res = computeResults([A, B, C], [
    { guestId: 1, plateIds: [10, 20, 30] },
    { guestId: 2, plateIds: [10, 30, 20] },
    { guestId: 3, plateIds: [20, 10, 30] },
  ])
  expect(res.map((r) => r.plateId)).toEqual([10, 20, 30])
  expect(res.map((r) => r.position)).toEqual([1, 2, 3])
  expect(res[0].score).toBeCloseTo(5 / 6)
  expect(res[1].score).toBeCloseTo(0.5)
  expect(res[2].score).toBeCloseTo(1 / 6)
  expect(res[0].avgRank).toBeCloseTo(4 / 3)
  expect(res[0]).toMatchObject({ votes: 3, bestRank: 1, worstRank: 2, firsts: 2 })
})

test('bulletin de moins de 2 assiettes ignoré, bulletin partiel compté', () => {
  const res = computeResults([A, B, C], [
    { guestId: 1, plateIds: [30] },
    { guestId: 2, plateIds: [10, 20] },
  ])
  const byId = Object.fromEntries(res.map((r) => [r.plateId, r]))
  expect(byId[10].score).toBe(1)
  expect(byId[20].score).toBe(0)
  expect(byId[30]).toMatchObject({ score: null, votes: 0, position: null, avgRank: null })
})

test('assiette sans voix en fin de classement, par numéro', () => {
  const res = computeResults([C, B, A], [{ guestId: 1, plateIds: [20, 10] }])
  expect(res.map((r) => r.plateId)).toEqual([20, 10, 30])
})

test('ex æquo : même position (1, 2, 2, 4), départage d’affichage par rang moyen puis numéro', () => {
  const res = computeResults([A, B, C, D], [
    { guestId: 1, plateIds: [10, 20, 30, 40] },
    { guestId: 2, plateIds: [10, 30, 20, 40] },
  ])
  expect(res.map((r) => r.plateId)).toEqual([10, 20, 30, 40])
  expect(res.map((r) => r.position)).toEqual([1, 2, 2, 4])
})

test('même note, rang moyen différent : même position, meilleur rang moyen affiché d’abord', () => {
  const res = computeResults([A, B, C, D], [
    { guestId: 1, plateIds: [30, 10, 40] }, // C=1 (r1), A=0,5 (r2), D=0 (r3)
    { guestId: 2, plateIds: [20, 30] },     // B=1 (r1), C=0 (r2)
    { guestId: 3, plateIds: [30, 20] },     // C=1 (r1), B=0 (r2)
  ])
  // C : 2/3 ; A : 0,5 (rang moy 2) ; B : 0,5 (rang moy 1,5) ; D : 0.
  // A et B sont ex æquo ; B passe devant malgré son numéro plus grand.
  expect(res.map((r) => r.plateId)).toEqual([30, 20, 10, 40])
  expect(res.map((r) => r.position)).toEqual([1, 2, 2, 4])
})

test('un bulletin qui cite une assiette inconnue ne la compte pas', () => {
  const res = computeResults([A, B], [{ guestId: 1, plateIds: [10, 99, 20] }])
  expect(res.find((r) => r.plateId === 20)?.score).toBe(0)
})

test('accord : identique 100, inversé 0, moins de 3 assiettes null', () => {
  expect(agreement([1, 2, 3], [1, 2, 3])).toBe(100)
  expect(agreement([3, 2, 1], [1, 2, 3])).toBe(0)
  expect(agreement([1, 2], [1, 2, 3])).toBeNull()
})

test('accord restreint aux assiettes du bulletin', () => {
  // Classement final 1..5 ; l'invité n'a classé que 2, 4, 5 dans le bon ordre.
  expect(agreement([2, 4, 5], [1, 2, 3, 4, 5])).toBe(100)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/contest-scoring.test.ts`
Expected: FAIL — `Failed to resolve import "../contest-scoring"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/contest-scoring.ts
// Calcul du concours (spec 2026-09-25 §2). Pur : aucune dépendance à la base, pour
// que chaque règle — normalisation, bulletins partiels, ex æquo — soit testable seule.

export type PlateRef = { id: number; number: number }
// Bulletin ordonné, meilleure assiette en premier.
export type Ballot = { guestId: number; plateIds: number[] }

export type PlateResult = {
  plateId: number
  // Rang de compétition (1, 2, 2, 4). null = assiette qui n'a reçu aucune voix.
  position: number | null
  // Moyenne des scores normalisés reçus, dans [0, 1]. L'affichage multiplie par 100.
  score: number | null
  avgRank: number | null
  votes: number
  bestRank: number | null
  worstRank: number | null
  firsts: number
}

// Les scores sont des fractions : deux moyennes « égales » peuvent différer au
// dernier bit selon l'ordre des additions. On compare avec une tolérance.
const EPS = 1e-9

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function computeResults(plates: PlateRef[], ballots: Ballot[]): PlateResult[] {
  const acc = new Map(plates.map((p) => [p.id, { scores: [] as number[], ranks: [] as number[] }]))
  for (const b of ballots) {
    // Une assiette supprimée entre-temps disparaît du bulletin : le rang des
    // suivantes remonte d'autant, ce qui revient au recompactage de la spec.
    const ids = b.plateIds.filter((id) => acc.has(id))
    const n = ids.length
    // Un bulletin d'une seule assiette ne compare rien : il ne compte pas.
    if (n < 2) continue
    ids.forEach((id, i) => {
      const a = acc.get(id)!
      a.scores.push((n - 1 - i) / (n - 1))
      a.ranks.push(i + 1)
    })
  }

  const numberOf = new Map(plates.map((p) => [p.id, p.number]))
  const rows: PlateResult[] = plates.map((p) => {
    const { scores, ranks } = acc.get(p.id)!
    const votes = scores.length
    return {
      plateId: p.id,
      position: null,
      score: votes ? mean(scores) : null,
      avgRank: votes ? mean(ranks) : null,
      votes,
      bestRank: votes ? Math.min(...ranks) : null,
      worstRank: votes ? Math.max(...ranks) : null,
      firsts: ranks.filter((r) => r === 1).length,
    }
  })

  rows.sort((x, y) => {
    if (x.score === null || y.score === null) {
      if (x.score !== y.score) return x.score === null ? 1 : -1
    } else {
      if (Math.abs(x.score - y.score) > EPS) return y.score - x.score
      if (Math.abs(x.avgRank! - y.avgRank!) > EPS) return x.avgRank! - y.avgRank!
    }
    return numberOf.get(x.plateId)! - numberOf.get(y.plateId)!
  })

  rows.forEach((r, i) => {
    if (r.score === null) return
    const prev = rows[i - 1]
    r.position = prev && prev.score !== null && Math.abs(prev.score - r.score) <= EPS ? prev.position : i + 1
  })
  return rows
}

// Accord d'un invité avec le groupe (spec §2) : Spearman entre son bulletin et
// l'ordre final restreint aux assiettes qu'il a classées, ramené en pourcentage.
export function agreement(ballot: number[], finalOrder: number[]): number | null {
  const pos = new Map(finalOrder.map((id, i) => [id, i]))
  const mine = ballot.filter((id) => pos.has(id))
  const n = mine.length
  if (n < 3) return null
  const consensus = [...mine].sort((a, b) => pos.get(a)! - pos.get(b)!)
  const consensusRank = new Map(consensus.map((id, i) => [id, i]))
  const d2 = mine.reduce((sum, id, i) => sum + (i - consensusRank.get(id)!) ** 2, 0)
  const rho = 1 - (6 * d2) / (n * (n * n - 1))
  return Math.round(((rho + 1) / 2) * 100)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/contest-scoring.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contest-scoring.ts src/lib/__tests__/contest-scoring.test.ts
git commit -m "feat(concours): calcul des résultats — score normalisé, ex æquo, accord"
```

---

### Task 2: Règles, révélation et classement invité (fonctions pures)

**Files:**
- Create: `src/lib/contest-rules.ts`, `src/lib/contest-reveal.ts`, `src/lib/contest-ranking.ts`
- Test: `src/lib/__tests__/contest-rules.test.ts`, `src/lib/__tests__/contest-reveal.test.ts`, `src/lib/__tests__/contest-ranking.test.ts`

**Interfaces:**
- Consumes: `PlateResult` (Task 1).
- Produces:
  - `contest-rules.ts` (isomorphe — **aucun import Node**, importé côté client) :
    `PHASES`, `type Phase = 'preparation' | 'voting' | 'closed' | 'reveal'`, `isPhase(v: unknown): v is Phase`, `shiftPhase(p: Phase, dir: 1 | -1): Phase`, `cleanName(raw: unknown): string | null`, `cleanLabel(raw: unknown): string | null`, `nextPlateNumber(numbers: number[]): number`, `shuffled<T>(items: T[], rand?: () => number): T[]`, `checkBallot(raw: unknown, allowed: Set<number>): number[] | null`
  - `contest-reveal.ts` : `type RevealStep = { kind: 'title' } | { kind: 'plate'; plateIds: number[]; position: number; showAuthors: boolean; podium: boolean } | { kind: 'final' }`, `buildRevealSteps(results: PlateResult[]): RevealStep[]`, `isFinalStep(step: number, steps: RevealStep[]): boolean`
  - `contest-ranking.ts` : `placeAt(ranking: number[], id: number, index: number): number[]`, `removeFrom(ranking: number[], id: number): number[]`, `moveBy(ranking: number[], id: number, delta: -1 | 1): number[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/contest-rules.test.ts
import { expect, test } from 'vitest'
import { checkBallot, cleanLabel, cleanName, isPhase, nextPlateNumber, shiftPhase, shuffled } from '../contest-rules'

test('phases : avancer et reculer, bornées', () => {
  expect(shiftPhase('preparation', 1)).toBe('voting')
  expect(shiftPhase('voting', -1)).toBe('preparation')
  expect(shiftPhase('reveal', 1)).toBe('reveal')
  expect(shiftPhase('preparation', -1)).toBe('preparation')
  expect(isPhase('closed')).toBe(true)
  expect(isPhase('nope')).toBe(false)
})

test('noms : espaces normalisés, vide ou trop long refusé', () => {
  expect(cleanName('  Julie   M. ')).toBe('Julie M.')
  expect(cleanName('   ')).toBeNull()
  expect(cleanName('x'.repeat(41))).toBeNull()
  expect(cleanName(42)).toBeNull()
})

test('label : facultatif, vide → null, 60 caractères max', () => {
  expect(cleanLabel('  Chocolat noir & sel ')).toBe('Chocolat noir & sel')
  expect(cleanLabel('')).toBeNull()
  expect(cleanLabel(undefined)).toBeNull()
  expect(cleanLabel('x'.repeat(61))).toBe('x'.repeat(60))
})

test('numéro suivant = max + 1, 1 si aucune assiette', () => {
  expect(nextPlateNumber([])).toBe(1)
  expect(nextPlateNumber([3, 1, 7])).toBe(8)
})

test('mélange : permutation des mêmes éléments, déterministe avec un rand fourni', () => {
  const out = shuffled([1, 2, 3, 4], () => 0)
  expect([...out].sort()).toEqual([1, 2, 3, 4])
  expect(out).not.toEqual([1, 2, 3, 4])
})

test('bulletin : entiers autorisés sans doublon, sinon null', () => {
  const allowed = new Set([1, 2, 3])
  expect(checkBallot([3, 1], allowed)).toEqual([3, 1])
  expect(checkBallot([], allowed)).toEqual([])
  expect(checkBallot([1, 1], allowed)).toBeNull()
  expect(checkBallot([1, 9], allowed)).toBeNull()
  expect(checkBallot(['1'], allowed)).toBeNull()
  expect(checkBallot('1,2', allowed)).toBeNull()
})
```

```ts
// src/lib/__tests__/contest-reveal.test.ts
import { expect, test } from 'vitest'
import type { PlateResult } from '../contest-scoring'
import { buildRevealSteps, isFinalStep } from '../contest-reveal'

const row = (plateId: number, position: number | null): PlateResult => ({
  plateId, position, score: position === null ? null : 1 / position, avgRank: position,
  votes: position === null ? 0 : 2, bestRank: position, worstRank: position, firsts: 0,
})

test('titre, puis du dernier au premier en deux temps, puis écran final', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2), row(3, 3), row(4, 4)])
  expect(steps[0]).toEqual({ kind: 'title' })
  expect(steps.slice(1, 3)).toEqual([
    { kind: 'plate', plateIds: [4], position: 4, showAuthors: false, podium: false },
    { kind: 'plate', plateIds: [4], position: 4, showAuthors: true, podium: false },
  ])
  expect(steps[3]).toMatchObject({ plateIds: [3], podium: true, showAuthors: false })
  expect(steps.at(-2)).toMatchObject({ plateIds: [1], position: 1, showAuthors: true })
  expect(steps.at(-1)).toEqual({ kind: 'final' })
  expect(steps).toHaveLength(1 + 4 * 2 + 1)
})

test('ex æquo révélés ensemble ; assiettes sans voix seulement à l’écran final', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2), row(3, 2), row(4, null)])
  const plateSteps = steps.filter((s) => s.kind === 'plate')
  expect(plateSteps[0]).toMatchObject({ plateIds: [2, 3], position: 2 })
  expect(plateSteps.some((s) => s.kind === 'plate' && s.plateIds.includes(4))).toBe(false)
})

test('isFinalStep', () => {
  const steps = buildRevealSteps([row(1, 1), row(2, 2)])
  expect(isFinalStep(steps.length - 1, steps)).toBe(true)
  expect(isFinalStep(0, steps)).toBe(false)
  expect(isFinalStep(99, steps)).toBe(true)
})
```

```ts
// src/lib/__tests__/contest-ranking.test.ts
import { expect, test } from 'vitest'
import { moveBy, placeAt, removeFrom } from '../contest-ranking'

test('placer une assiette à une position, ou la déplacer si déjà classée', () => {
  expect(placeAt([], 5, 0)).toEqual([5])
  expect(placeAt([1, 2], 5, 1)).toEqual([1, 5, 2])
  expect(placeAt([1, 2], 5, 9)).toEqual([1, 2, 5])
  expect(placeAt([1, 2, 3], 1, 2)).toEqual([2, 1, 3])
})

test('retirer', () => {
  expect(removeFrom([1, 2, 3], 2)).toEqual([1, 3])
  expect(removeFrom([1], 9)).toEqual([1])
})

test('monter / descendre, borné', () => {
  expect(moveBy([1, 2, 3], 3, -1)).toEqual([1, 3, 2])
  expect(moveBy([1, 2, 3], 1, -1)).toEqual([1, 2, 3])
  expect(moveBy([1, 2, 3], 1, 1)).toEqual([2, 1, 3])
  expect(moveBy([1, 2, 3], 3, 1)).toEqual([1, 2, 3])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/contest-rules.test.ts src/lib/__tests__/contest-reveal.test.ts src/lib/__tests__/contest-ranking.test.ts`
Expected: FAIL — imports introuvables.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/contest-rules.ts
// Règles du concours partagées serveur ↔ client. Aucun import Node ici : ce
// module est aussi chargé par les composants client (phases, validation locale).

export const PHASES = ['preparation', 'voting', 'closed', 'reveal'] as const
export type Phase = (typeof PHASES)[number]

export function isPhase(v: unknown): v is Phase {
  return typeof v === 'string' && (PHASES as readonly string[]).includes(v)
}

// L'admin peut reculer d'un cran (spec §3) : rouvrir des votes fermés trop tôt.
export function shiftPhase(p: Phase, dir: 1 | -1): Phase {
  const i = Math.min(PHASES.length - 1, Math.max(0, PHASES.indexOf(p) + dir))
  return PHASES[i]
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ')
  return name.length >= 1 && name.length <= 40 ? name : null
}

export function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const label = raw.trim().replace(/\s+/g, ' ').slice(0, 60)
  return label || null
}

export function nextPlateNumber(numbers: number[]): number {
  return numbers.length ? Math.max(...numbers) + 1 : 1
}

// Fisher-Yates. `rand` injectable pour des tests déterministes.
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Un bulletin arrive du client : on n'accepte qu'une liste d'identifiants entiers,
// sans doublon, tous dans `allowed` (assiettes du concours hors celles de l'invité).
// Toute anomalie rejette le bulletin entier — pas de réparation silencieuse.
export function checkBallot(raw: unknown, allowed: Set<number>): number[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<number>()
  for (const id of raw) {
    if (!Number.isInteger(id) || !allowed.has(id) || seen.has(id)) return null
    seen.add(id)
  }
  return raw as number[]
}
```

```ts
// src/lib/contest-reveal.ts
// Séquence de la scène (spec §10). `contests.reveal_step` est un index dans ce
// tableau ; le recalculer à partir des résultats (figés hors phase de vote) rend
// la reprise après rechargement exacte.
import type { PlateResult } from './contest-scoring'

export type RevealStep =
  | { kind: 'title' }
  | { kind: 'plate'; plateIds: number[]; position: number; showAuthors: boolean; podium: boolean }
  | { kind: 'final' }

export function buildRevealSteps(results: PlateResult[]): RevealStep[] {
  const groups = new Map<number, number[]>()
  for (const r of results) {
    if (r.position === null) continue
    groups.set(r.position, [...(groups.get(r.position) ?? []), r.plateId])
  }
  const steps: RevealStep[] = [{ kind: 'title' }]
  const positions = [...groups.keys()].sort((a, b) => b - a)
  for (const position of positions) {
    const plateIds = groups.get(position)!
    const podium = position <= 3
    steps.push({ kind: 'plate', plateIds, position, showAuthors: false, podium })
    steps.push({ kind: 'plate', plateIds, position, showAuthors: true, podium })
  }
  steps.push({ kind: 'final' })
  return steps
}

export function isFinalStep(step: number, steps: RevealStep[]): boolean {
  return step >= steps.length - 1
}
```

```ts
// src/lib/contest-ranking.ts
// Opérations sur le classement d'un invité (liste d'identifiants, meilleur d'abord).
// Pures et immuables : le composant les applique puis envoie le résultat entier.

export function placeAt(ranking: number[], id: number, index: number): number[] {
  const rest = ranking.filter((x) => x !== id)
  const i = Math.max(0, Math.min(index, rest.length))
  return [...rest.slice(0, i), id, ...rest.slice(i)]
}

export function removeFrom(ranking: number[], id: number): number[] {
  return ranking.filter((x) => x !== id)
}

export function moveBy(ranking: number[], id: number, delta: -1 | 1): number[] {
  const i = ranking.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ranking.length) return ranking
  const out = [...ranking]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/contest-rules.test.ts src/lib/__tests__/contest-reveal.test.ts src/lib/__tests__/contest-ranking.test.ts`
Expected: PASS. (Le test de mélange avec `rand = () => 0` donne `[2, 3, 4, 1]`, différent de l'entrée.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/contest-rules.ts src/lib/contest-reveal.ts src/lib/contest-ranking.ts src/lib/__tests__/contest-rules.test.ts src/lib/__tests__/contest-reveal.test.ts src/lib/__tests__/contest-ranking.test.ts
git commit -m "feat(concours): règles, séquence de révélation et opérations de classement"
```

---

### Task 3: Vues invité et admin (`contest-state.ts`)

**Files:**
- Create: `src/lib/contest-state.ts`
- Test: `src/lib/__tests__/contest-state.test.ts`

**Interfaces:**
- Consumes: `computeResults`, `agreement`, `Ballot` (Task 1) ; `Phase`, `buildRevealSteps`, `isFinalStep`, `RevealStep` (Task 2).
- Produces (types réutilisés par db, API et UI) :

```ts
export type Contest = { id: number; name: string; secret: string; phase: Phase; revealStep: number }
export type GuestRow = { id: number; name: string; claimed: boolean }
export type PlateRow = { id: number; number: number; label: string | null; authorIds: number[] }
export type ContestData = { guests: GuestRow[]; plates: PlateRow[]; ballots: Ballot[] }
export type ResultRow = {
  plateId: number; number: number; label: string | null; authors: string[]
  position: number | null; score: number | null /* 0–100 entier */; avgRank: number | null
  votes: number; bestRank: number | null; worstRank: number | null; firsts: number
}
export type GuestView = {
  name: string; phase: Phase; final: boolean
  me: { id: number; name: string } | null
  guests: { id: number; name: string; taken: boolean }[]
  plates: { id: number; number: number; label: string | null }[]
  myBallot: number[]
  results: { rows: ResultRow[]; agreement: number | null; myPlates: ResultRow[] } | null
}
export type AdminGuest = { id: number; name: string; claimed: boolean; ranked: number; rankable: number }
export type AdminView = {
  contest: Contest; guests: AdminGuest[]; plates: PlateRow[]
  rows: ResultRow[]; steps: RevealStep[]; complete: number
}
export function resultRows(data: ContestData): ResultRow[]
export function buildGuestView(contest: Contest, data: ContestData, meId: number | null): GuestView
export function buildAdminView(contest: Contest, data: ContestData): AdminView
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/contest-state.test.ts
import { expect, test } from 'vitest'
import { buildAdminView, buildGuestView, type Contest, type ContestData } from '../contest-state'

const contest = (phase: Contest['phase'], revealStep = 0): Contest =>
  ({ id: 1, name: 'Anniv', secret: 's3cr3t', phase, revealStep })

// Julie (1) a fait l'assiette 10 ; Marc (2) et Julie ont fait la 20 ; Léo (3) rien.
const data: ContestData = {
  guests: [
    { id: 1, name: 'Julie', claimed: true },
    { id: 2, name: 'Marc', claimed: false },
    { id: 3, name: 'Léo', claimed: true },
  ],
  plates: [
    { id: 10, number: 1, label: 'Noisette', authorIds: [1] },
    { id: 20, number: 2, label: null, authorIds: [1, 2] },
    { id: 30, number: 3, label: null, authorIds: [] },
  ],
  ballots: [
    { guestId: 3, plateIds: [30, 10, 20] },
    { guestId: 2, plateIds: [10, 30] },
  ],
}

test('invité : ses propres assiettes exclues, nom pris par un autre marqué', () => {
  const v = buildGuestView(contest('voting'), data, 1)
  expect(v.me).toEqual({ id: 1, name: 'Julie' })
  expect(v.plates.map((p) => p.id)).toEqual([30])
  expect(v.guests.find((g) => g.id === 3)?.taken).toBe(true)
  expect(v.guests.find((g) => g.id === 1)?.taken).toBe(false)
})

test('invité : ni auteurs ni scores avant l’écran final', () => {
  const v = buildGuestView(contest('reveal', 1), data, 3)
  expect(v.final).toBe(false)
  expect(v.results).toBeNull()
  expect(JSON.stringify(v)).not.toContain('authorIds')
})

test('invité : récapitulatif à l’écran final, avec accord et ses assiettes', () => {
  const steps = buildAdminView(contest('reveal'), data).steps
  const v = buildGuestView(contest('reveal', steps.length - 1), data, 2)
  expect(v.final).toBe(true)
  // Léo [30,10,20] → 30=1, 10=0,5, 20=0 ; Marc [10,30] → 10=1, 30=0.
  // 10 : 75 ; 30 : 50 ; 20 : 0.
  expect(v.results?.rows[0]).toMatchObject({ plateId: 10, score: 75, authors: ['Julie'] })
  expect(v.results?.myPlates.map((r) => r.plateId)).toEqual([20])
  expect(v.results?.myPlates[0].authors).toEqual(['Julie', 'Marc'])
  expect(v.myBallot).toEqual([10, 30])
})

test('admin : avancement par invité et nombre de bulletins complets', () => {
  const v = buildAdminView(contest('voting'), data)
  const byName = Object.fromEntries(v.guests.map((g) => [g.name, g]))
  expect(byName['Léo']).toMatchObject({ ranked: 3, rankable: 3 })
  expect(byName['Marc']).toMatchObject({ ranked: 2, rankable: 2 })
  expect(byName['Julie']).toMatchObject({ ranked: 0, rankable: 1 })
  expect(v.complete).toBe(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/contest-state.test.ts`
Expected: FAIL — import introuvable.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/contest-state.ts
// Ce que chaque écran a le droit de voir, construit à partir des données brutes.
// Pur, donc testable : c'est ICI que se joue la règle « aucun auteur ni score côté
// invité avant l'écran final de la scène » (spec §7).
import { agreement, computeResults, type Ballot } from './contest-scoring'
import type { Phase } from './contest-rules'
import { buildRevealSteps, isFinalStep, type RevealStep } from './contest-reveal'

export type Contest = { id: number; name: string; secret: string; phase: Phase; revealStep: number }
export type GuestRow = { id: number; name: string; claimed: boolean }
export type PlateRow = { id: number; number: number; label: string | null; authorIds: number[] }
export type ContestData = { guests: GuestRow[]; plates: PlateRow[]; ballots: Ballot[] }

export type ResultRow = {
  plateId: number
  number: number
  label: string | null
  authors: string[]
  position: number | null
  score: number | null
  avgRank: number | null
  votes: number
  bestRank: number | null
  worstRank: number | null
  firsts: number
}

export type GuestView = {
  name: string
  phase: Phase
  final: boolean
  me: { id: number; name: string } | null
  guests: { id: number; name: string; taken: boolean }[]
  plates: { id: number; number: number; label: string | null }[]
  myBallot: number[]
  results: { rows: ResultRow[]; agreement: number | null; myPlates: ResultRow[] } | null
}

export type AdminGuest = { id: number; name: string; claimed: boolean; ranked: number; rankable: number }

export type AdminView = {
  contest: Contest
  guests: AdminGuest[]
  plates: PlateRow[]
  rows: ResultRow[]
  steps: RevealStep[]
  complete: number
}

export function resultRows(data: ContestData): ResultRow[] {
  const nameOf = new Map(data.guests.map((g) => [g.id, g.name]))
  const plateOf = new Map(data.plates.map((p) => [p.id, p]))
  return computeResults(data.plates, data.ballots).map((r) => {
    const p = plateOf.get(r.plateId)!
    return {
      ...r,
      number: p.number,
      label: p.label,
      authors: p.authorIds.map((id) => nameOf.get(id)).filter((n): n is string => !!n).sort(),
      score: r.score === null ? null : Math.round(r.score * 100),
    }
  })
}

// Assiettes qu'un invité a le droit de classer : toutes sauf les siennes.
function rankableFor(data: ContestData, guestId: number) {
  return data.plates.filter((p) => !p.authorIds.includes(guestId))
}

function ballotOf(data: ContestData, guestId: number): number[] {
  const allowed = new Set(rankableFor(data, guestId).map((p) => p.id))
  return (data.ballots.find((b) => b.guestId === guestId)?.plateIds ?? []).filter((id) => allowed.has(id))
}

export function buildGuestView(contest: Contest, data: ContestData, meId: number | null): GuestView {
  const me = data.guests.find((g) => g.id === meId) ?? null
  const rows = resultRows(data)
  const final = contest.phase === 'reveal' && isFinalStep(contest.revealStep, buildRevealSteps(rows))
  const myBallot = me ? ballotOf(data, me.id) : []
  const finalOrder = rows.filter((r) => r.position !== null).map((r) => r.plateId)
  return {
    name: contest.name,
    phase: contest.phase,
    final,
    me: me && { id: me.id, name: me.name },
    guests: data.guests.map((g) => ({ id: g.id, name: g.name, taken: g.claimed && g.id !== me?.id })),
    plates: (me ? rankableFor(data, me.id) : data.plates).map(({ id, number, label }) => ({ id, number, label })),
    myBallot,
    results: final
      ? {
          rows,
          agreement: agreement(myBallot, finalOrder),
          myPlates: me ? rows.filter((r) => data.plates.find((p) => p.id === r.plateId)?.authorIds.includes(me.id)) : [],
        }
      : null,
  }
}

export function buildAdminView(contest: Contest, data: ContestData): AdminView {
  const rows = resultRows(data)
  const guests = data.guests.map((g) => ({
    ...g,
    ranked: ballotOf(data, g.id).length,
    rankable: rankableFor(data, g.id).length,
  }))
  return {
    contest,
    guests,
    plates: data.plates,
    rows,
    steps: buildRevealSteps(rows),
    complete: guests.filter((g) => g.rankable > 0 && g.ranked === g.rankable).length,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/contest-state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contest-state.ts src/lib/__tests__/contest-state.test.ts
git commit -m "feat(concours): vues invité et admin, sans fuite d'auteurs avant la révélation"
```

---

### Task 4: Schéma, couche data et identité d'appareil

**Files:**
- Modify: `scripts/migrate.mjs` (ajout avant `console.log('migration ok')`)
- Create: `src/lib/contest-db.ts`, `src/lib/contest-identity.ts`, `src/lib/contest-views.ts`
- Test: `src/lib/__tests__/contest-identity.test.ts`

**Interfaces:**
- Consumes: types `Contest`, `ContestData`, `GuestRow`, `PlateRow`, `GuestView`, `AdminView`, `buildGuestView`, `buildAdminView` (Task 3) ; `isPhase`, `Phase` (Task 2).
- Produces :
  - `contest-db.ts` :
    `type ContestSummary = { id: number; name: string; phase: Phase; guestCount: number; createdAt: string }`,
    `listContests(): Promise<ContestSummary[]>`, `createContest(name: string, secret: string): Promise<number>`, `deleteContest(id: number): Promise<void>`,
    `getContestById(id: number): Promise<Contest | null>`, `getContestBySecret(secret: string): Promise<Contest | null>`,
    `setPhase(id: number, phase: Phase): Promise<void>`, `setRevealStep(id: number, step: number): Promise<void>`,
    `addGuest(contestId: number, name: string): Promise<void>`, `renameGuest(contestId: number, guestId: number, name: string): Promise<void>`, `deleteGuest(contestId: number, guestId: number): Promise<void>`, `releaseGuest(contestId: number, guestId: number): Promise<void>`,
    `claimGuest(contestId: number, guestId: number, token: string): Promise<boolean>`, `findGuestIdByToken(contestId: number, token: string): Promise<number | null>`,
    `addPlate(contestId: number, p: { number: number; label: string | null; authorIds: number[] }): Promise<void>`, `updatePlate(contestId: number, plateId: number, p: { number: number; label: string | null; authorIds: number[] }): Promise<void>`, `deletePlate(contestId: number, plateId: number): Promise<void>`, `setPlateNumbers(contestId: number, pairs: { plateId: number; number: number }[]): Promise<void>`,
    `replaceBallot(guestId: number, plateIds: number[]): Promise<void>`, `loadContestData(contestId: number): Promise<ContestData>`,
    `isUniqueViolation(err: unknown): boolean`
  - `contest-identity.ts` : `generateSecret(): string` (12 caractères), `generateClaimToken(): string`, `guestCookieName(contestId: number): string`, `readGuestToken(contestId: number): Promise<string | null>`, `writeGuestToken(contestId: number, token: string): Promise<void>`
  - `contest-views.ts` : `loadGuestView(secret: string): Promise<GuestView | null>`, `loadAdminView(id: number): Promise<AdminView | null>`

- [ ] **Step 1: Write the failing test (identité)**

```ts
// src/lib/__tests__/contest-identity.test.ts
import { expect, test } from 'vitest'
import { generateClaimToken, generateSecret, guestCookieName } from '../contest-identity'

test('secret : 12 caractères url-safe, différent à chaque appel', () => {
  const a = generateSecret()
  expect(a).toMatch(/^[A-Za-z0-9_-]{12}$/)
  expect(generateSecret()).not.toBe(a)
})

test('jeton d’appareil : long et url-safe', () => {
  expect(generateClaimToken()).toMatch(/^[A-Za-z0-9_-]{32}$/)
})

test('un cookie par concours', () => {
  expect(guestCookieName(7)).toBe('cc_concours_7')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/contest-identity.test.ts`
Expected: FAIL — import introuvable.

- [ ] **Step 3: Write the identity module**

```ts
// src/lib/contest-identity.ts
// Secrets et identité d'appareil (spec §5). Serveur uniquement (node:crypto, cookies).
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

// 9 octets → 12 caractères base64url : ~72 bits, introuvable par énumération.
export function generateSecret(): string {
  return randomBytes(9).toString('base64url')
}

export function generateClaimToken(): string {
  return randomBytes(24).toString('base64url')
}

// Un cookie par concours : un même téléphone peut participer à deux concours
// sans que l'identité de l'un écrase l'autre.
export function guestCookieName(contestId: number): string {
  return `cc_concours_${contestId}`
}

export async function readGuestToken(contestId: number): Promise<string | null> {
  return (await cookies()).get(guestCookieName(contestId))?.value ?? null
}

export async function writeGuestToken(contestId: number, token: string): Promise<void> {
  ;(await cookies()).set(guestCookieName(contestId), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/contest-identity.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the migration**

Insérer dans `scripts/migrate.mjs`, juste avant `console.log('migration ok')` :

```js
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
```

- [ ] **Step 6: Write the data layer**

```ts
// src/lib/contest-db.ts
// Accès base du concours. Jamais de 'use cache' ici : l'état change à chaque vote
// et chaque écran le relit toutes les 2,5 s. Toute écriture est bornée à son
// concours (contest_id dans le WHERE) : un identifiant forgé ne traverse pas.
import { getSql } from './db'
import { isPhase, type Phase } from './contest-rules'
import type { Contest, ContestData } from './contest-state'

export type ContestSummary = { id: number; name: string; phase: Phase; guestCount: number; createdAt: string }

type ContestRecord = { id: number; name: string; secret: string; phase: string; reveal_step: number }

function toContest(r: ContestRecord): Contest {
  return { id: r.id, name: r.name, secret: r.secret, phase: isPhase(r.phase) ? r.phase : 'preparation', revealStep: r.reveal_step }
}

// Code Postgres d'une violation d'unicité (nom d'invité ou numéro d'assiette pris).
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

export async function listContests(): Promise<ContestSummary[]> {
  const rows = (await getSql()`
    SELECT c.id, c.name, c.phase, c.created_at, count(g.id)::int AS guest_count
    FROM contests c LEFT JOIN contest_guests g ON g.contest_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `) as { id: number; name: string; phase: string; created_at: string | Date; guest_count: number }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phase: isPhase(r.phase) ? r.phase : 'preparation',
    guestCount: r.guest_count,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}

export async function createContest(name: string, secret: string): Promise<number> {
  const rows = (await getSql()`INSERT INTO contests (name, secret) VALUES (${name}, ${secret}) RETURNING id`) as { id: number }[]
  return rows[0].id
}

export async function deleteContest(id: number): Promise<void> {
  await getSql()`DELETE FROM contests WHERE id = ${id}`
}

export async function getContestById(id: number): Promise<Contest | null> {
  const rows = (await getSql()`SELECT id, name, secret, phase, reveal_step FROM contests WHERE id = ${id}`) as ContestRecord[]
  return rows[0] ? toContest(rows[0]) : null
}

export async function getContestBySecret(secret: string): Promise<Contest | null> {
  const rows = (await getSql()`SELECT id, name, secret, phase, reveal_step FROM contests WHERE secret = ${secret}`) as ContestRecord[]
  return rows[0] ? toContest(rows[0]) : null
}

export async function setPhase(id: number, phase: Phase): Promise<void> {
  // Revenir avant la révélation remet la scène au début : sinon un aller-retour
  // de phase laisserait les téléphones sur l'écran final.
  await getSql()`
    UPDATE contests SET phase = ${phase}, updated_at = now(),
      reveal_step = CASE WHEN ${phase} = 'reveal' THEN reveal_step ELSE 0 END
    WHERE id = ${id}
  `
}

export async function setRevealStep(id: number, step: number): Promise<void> {
  await getSql()`UPDATE contests SET reveal_step = ${step}, updated_at = now() WHERE id = ${id}`
}

export async function addGuest(contestId: number, name: string): Promise<void> {
  await getSql()`INSERT INTO contest_guests (contest_id, name) VALUES (${contestId}, ${name})`
}

export async function renameGuest(contestId: number, guestId: number, name: string): Promise<void> {
  await getSql()`UPDATE contest_guests SET name = ${name} WHERE id = ${guestId} AND contest_id = ${contestId}`
}

export async function deleteGuest(contestId: number, guestId: number): Promise<void> {
  await getSql()`DELETE FROM contest_guests WHERE id = ${guestId} AND contest_id = ${contestId}`
}

export async function releaseGuest(contestId: number, guestId: number): Promise<void> {
  await getSql()`UPDATE contest_guests SET claim_token = NULL WHERE id = ${guestId} AND contest_id = ${contestId}`
}

// Atomique : deux téléphones qui choisissent le même nom au même instant, un
// seul gagne (la condition `claim_token IS NULL` est évaluée par la mise à jour).
export async function claimGuest(contestId: number, guestId: number, token: string): Promise<boolean> {
  const rows = (await getSql()`
    UPDATE contest_guests SET claim_token = ${token}
    WHERE id = ${guestId} AND contest_id = ${contestId} AND claim_token IS NULL
    RETURNING id
  `) as { id: number }[]
  return rows.length === 1
}

export async function findGuestIdByToken(contestId: number, token: string): Promise<number | null> {
  const rows = (await getSql()`
    SELECT id FROM contest_guests WHERE contest_id = ${contestId} AND claim_token = ${token}
  `) as { id: number }[]
  return rows[0]?.id ?? null
}

type PlateInput = { number: number; label: string | null; authorIds: number[] }

export async function addPlate(contestId: number, p: PlateInput): Promise<void> {
  const sql = getSql()
  // CTE unique : l'assiette et ses auteurs naissent ensemble ou pas du tout.
  // Les auteurs sont filtrés sur les invités DE CE concours.
  await sql`
    WITH plate AS (
      INSERT INTO contest_plates (contest_id, number, label) VALUES (${contestId}, ${p.number}, ${p.label}) RETURNING id
    )
    INSERT INTO contest_plate_authors (plate_id, guest_id)
    SELECT plate.id, g.id FROM plate, contest_guests g
    WHERE g.contest_id = ${contestId} AND g.id = ANY(${p.authorIds}::int[])
  `
}

export async function updatePlate(contestId: number, plateId: number, p: PlateInput): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`UPDATE contest_plates SET number = ${p.number}, label = ${p.label} WHERE id = ${plateId} AND contest_id = ${contestId}`,
    sql`DELETE FROM contest_plate_authors WHERE plate_id = ${plateId}
        AND plate_id IN (SELECT id FROM contest_plates WHERE contest_id = ${contestId})`,
    sql`INSERT INTO contest_plate_authors (plate_id, guest_id)
        SELECT p.id, g.id FROM contest_plates p, contest_guests g
        WHERE p.id = ${plateId} AND p.contest_id = ${contestId}
          AND g.contest_id = ${contestId} AND g.id = ANY(${p.authorIds}::int[])`,
    // Un invité devenu auteur ne classe plus cette assiette (spec §11).
    sql`DELETE FROM contest_ballots WHERE plate_id = ${plateId} AND guest_id = ANY(${p.authorIds}::int[])`,
  ])
}

export async function deletePlate(contestId: number, plateId: number): Promise<void> {
  await getSql()`DELETE FROM contest_plates WHERE id = ${plateId} AND contest_id = ${contestId}`
}

export async function setPlateNumbers(contestId: number, pairs: { plateId: number; number: number }[]): Promise<void> {
  const ids = pairs.map((p) => p.plateId)
  const numbers = pairs.map((p) => p.number)
  await getSql()`
    UPDATE contest_plates p SET number = m.number
    FROM unnest(${ids}::int[], ${numbers}::int[]) AS m(id, number)
    WHERE p.id = m.id AND p.contest_id = ${contestId}
  `
}

// Le bulletin est remplacé en entier, en une transaction : le client envoie
// toujours la liste complète, jamais un différentiel (pas de conflit possible).
export async function replaceBallot(guestId: number, plateIds: number[]): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`DELETE FROM contest_ballots WHERE guest_id = ${guestId}`,
    sql`INSERT INTO contest_ballots (guest_id, plate_id, rank)
        SELECT ${guestId}, t.plate_id, t.rank
        FROM unnest(${plateIds}::int[]) WITH ORDINALITY AS t(plate_id, rank)`,
  ])
}

export async function loadContestData(contestId: number): Promise<ContestData> {
  const sql = getSql()
  const [guests, plates, ballots] = await Promise.all([
    sql`SELECT id, name, claim_token IS NOT NULL AS claimed FROM contest_guests
        WHERE contest_id = ${contestId} ORDER BY lower(name)` as Promise<{ id: number; name: string; claimed: boolean }[]>,
    sql`SELECT p.id, p.number, p.label,
          coalesce(array_agg(a.guest_id) FILTER (WHERE a.guest_id IS NOT NULL), '{}') AS author_ids
        FROM contest_plates p LEFT JOIN contest_plate_authors a ON a.plate_id = p.id
        WHERE p.contest_id = ${contestId} GROUP BY p.id ORDER BY p.number` as Promise<
      { id: number; number: number; label: string | null; author_ids: number[] }[]
    >,
    sql`SELECT b.guest_id, array_agg(b.plate_id ORDER BY b.rank) AS plate_ids
        FROM contest_ballots b JOIN contest_guests g ON g.id = b.guest_id
        WHERE g.contest_id = ${contestId} GROUP BY b.guest_id` as Promise<{ guest_id: number; plate_ids: number[] }[]>,
  ])
  return {
    guests,
    plates: plates.map((p) => ({ id: p.id, number: p.number, label: p.label, authorIds: p.author_ids })),
    ballots: ballots.map((b) => ({ guestId: b.guest_id, plateIds: b.plate_ids })),
  }
}
```

Note d'implémentation : si TypeScript refuse les `as Promise<…>` sur le type de retour du tag `sql` (union `Record<string, any>[] | FullQueryResults`), passer par `as unknown as Promise<…>` — même principe que les `as Row[]` de `src/lib/shops.ts`. Vérifier que `sql.transaction` existe bien sur le type exporté par `@neondatabase/serverless` (`grep -n "transaction" node_modules/@neondatabase/serverless/index.d.ts`).

- [ ] **Step 7: Write the views module**

```ts
// src/lib/contest-views.ts
// Point de passage unique entre la base et ce qu'un écran reçoit : la page
// (rendu initial) et la route de polling appellent la même fonction, donc ne
// peuvent pas diverger sur ce qui est montré.
import { getContestById, getContestBySecret, findGuestIdByToken, loadContestData } from './contest-db'
import { readGuestToken } from './contest-identity'
import { buildAdminView, buildGuestView, type AdminView, type GuestView } from './contest-state'

export async function loadGuestView(secret: string): Promise<GuestView | null> {
  const contest = await getContestBySecret(secret)
  if (!contest) return null
  const token = await readGuestToken(contest.id)
  const [meId, data] = await Promise.all([
    token ? findGuestIdByToken(contest.id, token) : Promise.resolve(null),
    loadContestData(contest.id),
  ])
  return buildGuestView(contest, data, meId)
}

export async function loadAdminView(id: number): Promise<AdminView | null> {
  const contest = await getContestById(id)
  if (!contest) return null
  return buildAdminView(contest, await loadContestData(contest.id))
}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur dans les nouveaux fichiers.

- [ ] **Step 9: Commit**

```bash
git add scripts/migrate.mjs src/lib/contest-db.ts src/lib/contest-identity.ts src/lib/contest-views.ts src/lib/__tests__/contest-identity.test.ts
git commit -m "feat(concours): schéma, couche data et identité d'appareil"
```

(La migration n'est PAS lancée ici — voir Task 12.)

---

### Task 5: Server actions invité

**Files:**
- Create: `src/app/actions/contest-guest.ts`
- Test: `src/app/actions/__tests__/contest-guest.test.ts`

**Interfaces:**
- Consumes: `getContestBySecret`, `claimGuest`, `findGuestIdByToken`, `loadContestData`, `replaceBallot` (Task 4) ; `generateClaimToken`, `readGuestToken`, `writeGuestToken` (Task 4) ; `checkBallot` (Task 2).
- Produces:
  - `claimNameAction(secret: string, guestId: number): Promise<{ ok: true } | { ok: false; error: 'not-found' | 'taken' }>`
  - `saveBallotAction(secret: string, plateIds: number[]): Promise<{ ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'closed' | 'invalid' }>`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/actions/__tests__/contest-guest.test.ts
import { beforeEach, expect, test, vi } from 'vitest'

const db = {
  getContestBySecret: vi.fn(),
  claimGuest: vi.fn(),
  findGuestIdByToken: vi.fn(),
  loadContestData: vi.fn(),
  replaceBallot: vi.fn(),
}
const identity = { generateClaimToken: vi.fn(), readGuestToken: vi.fn(), writeGuestToken: vi.fn() }
vi.mock('@/lib/contest-db', () => ({
  getContestBySecret: (...a: unknown[]) => db.getContestBySecret(...a),
  claimGuest: (...a: unknown[]) => db.claimGuest(...a),
  findGuestIdByToken: (...a: unknown[]) => db.findGuestIdByToken(...a),
  loadContestData: (...a: unknown[]) => db.loadContestData(...a),
  replaceBallot: (...a: unknown[]) => db.replaceBallot(...a),
}))
vi.mock('@/lib/contest-identity', () => ({
  generateClaimToken: () => identity.generateClaimToken(),
  readGuestToken: (...a: unknown[]) => identity.readGuestToken(...a),
  writeGuestToken: (...a: unknown[]) => identity.writeGuestToken(...a),
}))

import { claimNameAction, saveBallotAction } from '../contest-guest'

const contest = { id: 1, name: 'Anniv', secret: 's', phase: 'voting', revealStep: 0 }
const data = {
  guests: [{ id: 5, name: 'Julie', claimed: true }],
  plates: [
    { id: 10, number: 1, label: null, authorIds: [5] },
    { id: 20, number: 2, label: null, authorIds: [] },
    { id: 30, number: 3, label: null, authorIds: [] },
  ],
  ballots: [],
}

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset())
  Object.values(identity).forEach((f) => f.mockReset())
  db.getContestBySecret.mockResolvedValue(contest)
  db.claimGuest.mockResolvedValue(true)
  db.findGuestIdByToken.mockResolvedValue(5)
  db.loadContestData.mockResolvedValue(data)
  identity.generateClaimToken.mockReturnValue('tok')
  identity.readGuestToken.mockResolvedValue('tok')
})

test('choisir un nom libre : jeton posé en base et en cookie', async () => {
  expect(await claimNameAction('s', 5)).toEqual({ ok: true })
  expect(db.claimGuest).toHaveBeenCalledWith(1, 5, 'tok')
  expect(identity.writeGuestToken).toHaveBeenCalledWith(1, 'tok')
})

test('nom déjà pris : refusé, aucun cookie', async () => {
  db.claimGuest.mockResolvedValue(false)
  expect(await claimNameAction('s', 5)).toEqual({ ok: false, error: 'taken' })
  expect(identity.writeGuestToken).not.toHaveBeenCalled()
})

test('concours inconnu', async () => {
  db.getContestBySecret.mockResolvedValue(null)
  expect(await claimNameAction('x', 5)).toEqual({ ok: false, error: 'not-found' })
  expect(await saveBallotAction('x', [20])).toEqual({ ok: false, error: 'not-found' })
})

test('bulletin valide enregistré en entier', async () => {
  expect(await saveBallotAction('s', [30, 20])).toEqual({ ok: true })
  expect(db.replaceBallot).toHaveBeenCalledWith(5, [30, 20])
})

test('sans identité valide : refusé', async () => {
  db.findGuestIdByToken.mockResolvedValue(null)
  expect(await saveBallotAction('s', [20])).toEqual({ ok: false, error: 'no-identity' })
  identity.readGuestToken.mockResolvedValue(null)
  expect(await saveBallotAction('s', [20])).toEqual({ ok: false, error: 'no-identity' })
  expect(db.replaceBallot).not.toHaveBeenCalled()
})

test('hors phase de vote : refusé', async () => {
  db.getContestBySecret.mockResolvedValue({ ...contest, phase: 'closed' })
  expect(await saveBallotAction('s', [20])).toEqual({ ok: false, error: 'closed' })
  expect(db.replaceBallot).not.toHaveBeenCalled()
})

test('sa propre assiette, une assiette inconnue ou un doublon : refusé', async () => {
  expect(await saveBallotAction('s', [10, 20])).toEqual({ ok: false, error: 'invalid' })
  expect(await saveBallotAction('s', [99])).toEqual({ ok: false, error: 'invalid' })
  expect(await saveBallotAction('s', [20, 20])).toEqual({ ok: false, error: 'invalid' })
  expect(db.replaceBallot).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/contest-guest.test.ts`
Expected: FAIL — import introuvable.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/actions/contest-guest.ts
'use server'

import { claimGuest, findGuestIdByToken, getContestBySecret, loadContestData, replaceBallot } from '@/lib/contest-db'
import { generateClaimToken, readGuestToken, writeGuestToken } from '@/lib/contest-identity'
import { checkBallot } from '@/lib/contest-rules'

type ClaimResult = { ok: true } | { ok: false; error: 'not-found' | 'taken' }
type BallotResult = { ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'closed' | 'invalid' }

// Le secret du concours tient lieu d'autorisation (spec §5) : sans lui, rien.
export async function claimNameAction(secret: string, guestId: number): Promise<ClaimResult> {
  const contest = await getContestBySecret(secret)
  if (!contest) return { ok: false, error: 'not-found' }
  const token = generateClaimToken()
  if (!(await claimGuest(contest.id, guestId, token))) return { ok: false, error: 'taken' }
  await writeGuestToken(contest.id, token)
  return { ok: true }
}

export async function saveBallotAction(secret: string, plateIds: number[]): Promise<BallotResult> {
  const contest = await getContestBySecret(secret)
  if (!contest) return { ok: false, error: 'not-found' }
  const token = await readGuestToken(contest.id)
  const guestId = token ? await findGuestIdByToken(contest.id, token) : null
  if (guestId === null) return { ok: false, error: 'no-identity' }
  if (contest.phase !== 'voting') return { ok: false, error: 'closed' }
  const data = await loadContestData(contest.id)
  // Les assiettes dont l'invité est auteur ne sont pas « autorisées » : un client
  // modifié ne peut pas se classer lui-même.
  const allowed = new Set(data.plates.filter((p) => !p.authorIds.includes(guestId)).map((p) => p.id))
  const ballot = checkBallot(plateIds, allowed)
  if (!ballot) return { ok: false, error: 'invalid' }
  await replaceBallot(guestId, ballot)
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/contest-guest.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/contest-guest.ts src/app/actions/__tests__/contest-guest.test.ts
git commit -m "feat(concours): actions invité — choisir son nom, enregistrer son bulletin"
```

---

### Task 6: Server actions admin

**Files:**
- Create: `src/app/actions/contest-admin.ts`
- Test: `src/app/actions/__tests__/contest-admin.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`src/lib/auth.ts`) ; tout `contest-db.ts` (Task 4) ; `generateSecret` (Task 4) ; `cleanName`, `cleanLabel`, `nextPlateNumber`, `shuffled`, `shiftPhase` (Task 2) ; `loadAdminView` (Task 4).
- Produces (toutes `requireAdmin()` d'abord ; `type AdminResult = { ok: true } | { ok: false; error: string }`) :
  - `createContestAction(name: string): Promise<{ ok: true; id: number } | { ok: false; error: 'name' }>`
  - `deleteContestAction(id: number): Promise<AdminResult>`
  - `addGuestAction(contestId: number, name: string)`, `renameGuestAction(contestId: number, guestId: number, name: string)` → erreurs `'name'` | `'name-taken'`
  - `deleteGuestAction(contestId: number, guestId: number)`, `releaseGuestAction(contestId: number, guestId: number)`
  - `savePlateAction(contestId: number, input: { id?: number; number?: number; label?: string; authorIds: number[] })` → erreurs `'number'` | `'number-taken'`
  - `deletePlateAction(contestId: number, plateId: number)`
  - `shufflePlatesAction(contestId: number)` → erreur `'locked'` hors `preparation`
  - `shiftPhaseAction(contestId: number, dir: 1 | -1)`
  - `setRevealStepAction(contestId: number, step: number)` → erreur `'locked'` hors `reveal` ; borne `0 … steps.length - 1`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/actions/__tests__/contest-admin.test.ts
import { beforeEach, expect, test, vi } from 'vitest'

// vi.hoisted : la fabrique de vi.mock('@/lib/contest-db') parcourt `db` dès son
// exécution (Object.keys), qui a lieu AVANT les déclarations du module de test.
const { db, requireAdmin, loadAdminView } = vi.hoisted(() => {
  const names = [
    'createContest', 'deleteContest', 'getContestById', 'setPhase', 'setRevealStep', 'addGuest', 'renameGuest',
    'deleteGuest', 'releaseGuest', 'addPlate', 'updatePlate', 'deletePlate', 'setPlateNumbers', 'loadContestData',
  ]
  return {
    db: Object.fromEntries(names.map((n) => [n, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
    requireAdmin: vi.fn(),
    loadAdminView: vi.fn(),
  }
})

vi.mock('@/lib/auth', () => ({ requireAdmin: () => requireAdmin() }))
vi.mock('@/lib/contest-identity', () => ({ generateSecret: () => 'SECRET123456' }))
vi.mock('@/lib/contest-views', () => ({ loadAdminView: (...a: unknown[]) => loadAdminView(...a) }))
vi.mock('@/lib/contest-db', () => ({
  isUniqueViolation: (e: unknown) => (e as { code?: string })?.code === '23505',
  ...Object.fromEntries(Object.keys(db).map((k) => [k, (...a: unknown[]) => db[k](...a)])),
}))

import {
  addGuestAction, createContestAction, savePlateAction, setRevealStepAction, shiftPhaseAction, shufflePlatesAction,
} from '../contest-admin'

const contest = (phase: string) => ({ id: 1, name: 'Anniv', secret: 's', phase, revealStep: 0 })
const plates = [
  { id: 10, number: 1, label: null, authorIds: [] },
  { id: 20, number: 2, label: null, authorIds: [] },
]

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined)
  Object.values(db).forEach((f) => f.mockReset())
  loadAdminView.mockReset()
  db.getContestById.mockResolvedValue(contest('preparation'))
  db.loadContestData.mockResolvedValue({ guests: [], plates, ballots: [] })
  db.createContest.mockResolvedValue(42)
})

test('toute action exige la session admin', async () => {
  requireAdmin.mockRejectedValue(new Error('Unauthorized'))
  await expect(createContestAction('Anniv')).rejects.toThrow('Unauthorized')
  expect(db.createContest).not.toHaveBeenCalled()
})

test('création : nom nettoyé, secret généré', async () => {
  expect(await createContestAction('  Anniv  Léo ')).toEqual({ ok: true, id: 42 })
  expect(db.createContest).toHaveBeenCalledWith('Anniv Léo', 'SECRET123456')
  expect(await createContestAction('  ')).toEqual({ ok: false, error: 'name' })
})

test('invité en double : erreur lisible', async () => {
  db.addGuest.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
  expect(await addGuestAction(1, 'Julie')).toEqual({ ok: false, error: 'name-taken' })
})

test('nouvelle assiette : numéro automatique = max + 1', async () => {
  expect(await savePlateAction(1, { label: ' Noisette ', authorIds: [5] })).toEqual({ ok: true })
  expect(db.addPlate).toHaveBeenCalledWith(1, { number: 3, label: 'Noisette', authorIds: [5] })
})

test('assiette modifiée : numéro pris refusé', async () => {
  db.updatePlate.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
  expect(await savePlateAction(1, { id: 10, number: 2, authorIds: [] })).toEqual({ ok: false, error: 'number-taken' })
  expect(await savePlateAction(1, { id: 10, number: 0, authorIds: [] })).toEqual({ ok: false, error: 'number' })
})

test('mélange : seulement en préparation, permutation des numéros existants', async () => {
  expect(await shufflePlatesAction(1)).toEqual({ ok: true })
  const pairs = db.setPlateNumbers.mock.calls[0][1] as { plateId: number; number: number }[]
  expect(pairs.map((p) => p.number).sort()).toEqual([1, 2])
  db.getContestById.mockResolvedValue(contest('voting'))
  expect(await shufflePlatesAction(1)).toEqual({ ok: false, error: 'locked' })
})

test('phase : avance d’un cran', async () => {
  await shiftPhaseAction(1, 1)
  expect(db.setPhase).toHaveBeenCalledWith(1, 'voting')
})

test('étape de révélation : seulement en phase reveal, bornée', async () => {
  expect(await setRevealStepAction(1, 2)).toEqual({ ok: false, error: 'locked' })
  db.getContestById.mockResolvedValue(contest('reveal'))
  loadAdminView.mockResolvedValue({ contest: contest('reveal'), steps: [{}, {}, {}] })
  expect(await setRevealStepAction(1, 99)).toEqual({ ok: true })
  expect(db.setRevealStep).toHaveBeenCalledWith(1, 2)
  expect(await setRevealStepAction(1, -3)).toEqual({ ok: true })
  expect(db.setRevealStep).toHaveBeenLastCalledWith(1, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/contest-admin.test.ts`
Expected: FAIL — import introuvable.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/actions/contest-admin.ts
'use server'

import { requireAdmin } from '@/lib/auth'
import {
  addGuest, addPlate, createContest, deleteContest, deleteGuest, deletePlate, getContestById, isUniqueViolation,
  loadContestData, releaseGuest, renameGuest, setPhase, setPlateNumbers, setRevealStep, updatePlate,
} from '@/lib/contest-db'
import { generateSecret } from '@/lib/contest-identity'
import { cleanLabel, cleanName, nextPlateNumber, shiftPhase, shuffled } from '@/lib/contest-rules'
import { loadAdminView } from '@/lib/contest-views'

type AdminResult = { ok: true } | { ok: false; error: string }
const OK = { ok: true } as const

export async function createContestAction(name: string): Promise<{ ok: true; id: number } | { ok: false; error: 'name' }> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  return { ok: true, id: await createContest(clean, generateSecret()) }
}

export async function deleteContestAction(id: number): Promise<AdminResult> {
  await requireAdmin()
  await deleteContest(id)
  return OK
}

export async function addGuestAction(contestId: number, name: string): Promise<AdminResult> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  try {
    await addGuest(contestId, clean)
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'name-taken' }
    throw err
  }
  return OK
}

export async function renameGuestAction(contestId: number, guestId: number, name: string): Promise<AdminResult> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  try {
    await renameGuest(contestId, guestId, clean)
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'name-taken' }
    throw err
  }
  return OK
}

export async function deleteGuestAction(contestId: number, guestId: number): Promise<AdminResult> {
  await requireAdmin()
  await deleteGuest(contestId, guestId)
  return OK
}

export async function releaseGuestAction(contestId: number, guestId: number): Promise<AdminResult> {
  await requireAdmin()
  await releaseGuest(contestId, guestId)
  return OK
}

type PlateInput = { id?: number; number?: number; label?: string; authorIds: number[] }

export async function savePlateAction(contestId: number, input: PlateInput): Promise<AdminResult> {
  await requireAdmin()
  const label = cleanLabel(input.label)
  const authorIds = input.authorIds.filter(Number.isInteger)
  let number = input.number
  if (number === undefined) {
    const { plates } = await loadContestData(contestId)
    number = nextPlateNumber(plates.map((p) => p.number))
  }
  if (!Number.isInteger(number) || number < 1) return { ok: false, error: 'number' }
  try {
    if (input.id === undefined) await addPlate(contestId, { number, label, authorIds })
    else await updatePlate(contestId, input.id, { number, label, authorIds })
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'number-taken' }
    throw err
  }
  return OK
}

export async function deletePlateAction(contestId: number, plateId: number): Promise<AdminResult> {
  await requireAdmin()
  await deletePlate(contestId, plateId)
  return OK
}

// Renuméroter pendant les votes désorienterait des invités qui ont déjà classé
// « l'assiette 4 » : le mélange n'existe qu'en préparation (spec §9).
export async function shufflePlatesAction(contestId: number): Promise<AdminResult> {
  await requireAdmin()
  const contest = await getContestById(contestId)
  if (!contest || contest.phase !== 'preparation') return { ok: false, error: 'locked' }
  const { plates } = await loadContestData(contestId)
  const numbers = shuffled(plates.map((p) => p.number))
  await setPlateNumbers(contestId, plates.map((p, i) => ({ plateId: p.id, number: numbers[i] })))
  return OK
}

export async function shiftPhaseAction(contestId: number, dir: 1 | -1): Promise<AdminResult> {
  await requireAdmin()
  const contest = await getContestById(contestId)
  if (!contest) return { ok: false, error: 'not-found' }
  await setPhase(contestId, shiftPhase(contest.phase, dir))
  return OK
}

export async function setRevealStepAction(contestId: number, step: number): Promise<AdminResult> {
  await requireAdmin()
  const contest = await getContestById(contestId)
  if (!contest || contest.phase !== 'reveal') return { ok: false, error: 'locked' }
  const view = await loadAdminView(contestId)
  if (!view) return { ok: false, error: 'not-found' }
  await setRevealStep(contestId, Math.max(0, Math.min(Math.trunc(step), view.steps.length - 1)))
  return OK
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/contest-admin.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/contest-admin.ts src/app/actions/__tests__/contest-admin.test.ts
git commit -m "feat(concours): actions admin — concours, invités, assiettes, phases, révélation"
```

---

### Task 7: Routes d'état et non-indexation

**Files:**
- Create: `src/app/api/concours/[secret]/etat/route.ts`, `src/app/api/admin/concours/[id]/etat/route.ts`, `src/app/concours/layout.tsx`
- Modify: `src/app/robots.ts`, `next.config.ts`
- Test: `src/app/api/concours/__tests__/etat-route.test.ts`, `src/app/__tests__/robots.test.ts`, `src/app/__tests__/next-config.test.ts`

**Interfaces:**
- Consumes: `loadGuestView`, `loadAdminView` (Task 4) ; `isAdmin` (`src/lib/auth.ts`).
- Produces: `GET /api/concours/[secret]/etat` → `GuestView` JSON | 404 ; `GET /api/admin/concours/[id]/etat` → `AdminView` JSON | 401 | 404. Les deux avec `X-Robots-Tag: noindex, nofollow` et `Cache-Control: no-store`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/concours/__tests__/etat-route.test.ts
import { beforeEach, expect, test, vi } from 'vitest'

const loadGuestView = vi.fn()
const loadAdminView = vi.fn()
const isAdmin = vi.fn()
vi.mock('@/lib/contest-views', () => ({
  loadGuestView: (...a: unknown[]) => loadGuestView(...a),
  loadAdminView: (...a: unknown[]) => loadAdminView(...a),
}))
vi.mock('@/lib/auth', () => ({ isAdmin: () => isAdmin() }))

import { GET as guestGET } from '../[secret]/etat/route'
import { GET as adminGET } from '../../admin/concours/[id]/etat/route'

beforeEach(() => {
  loadGuestView.mockReset().mockResolvedValue({ name: 'Anniv' })
  loadAdminView.mockReset().mockResolvedValue({ contest: { id: 1 } })
  isAdmin.mockReset().mockResolvedValue(true)
})

const req = new Request('http://x')

test('invité : état, non indexé, jamais mis en cache', async () => {
  const res = await guestGET(req, { params: Promise.resolve({ secret: 'abc' }) })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ name: 'Anniv' })
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  expect(res.headers.get('Cache-Control')).toBe('no-store')
  expect(loadGuestView).toHaveBeenCalledWith('abc')
})

test('invité : secret inconnu → 404', async () => {
  loadGuestView.mockResolvedValue(null)
  const res = await guestGET(req, { params: Promise.resolve({ secret: 'nope' }) })
  expect(res.status).toBe(404)
})

test('admin : 401 sans session, 404 id invalide, état sinon', async () => {
  isAdmin.mockResolvedValue(false)
  expect((await adminGET(req, { params: Promise.resolve({ id: '1' }) })).status).toBe(401)
  isAdmin.mockResolvedValue(true)
  expect((await adminGET(req, { params: Promise.resolve({ id: 'abc' }) })).status).toBe(404)
  const res = await adminGET(req, { params: Promise.resolve({ id: '1' }) })
  expect(res.status).toBe(200)
  expect(loadAdminView).toHaveBeenCalledWith(1)
})
```

```ts
// src/app/__tests__/robots.test.ts
import { expect, test } from 'vitest'
import robots from '../robots'

test('robots.txt exclut l’admin, l’API et les concours', () => {
  const rules = robots().rules
  const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow
  expect(disallow).toEqual(expect.arrayContaining(['/admin', '/api/', '/concours/']))
})
```

```ts
// src/app/__tests__/next-config.test.ts
import { expect, test } from 'vitest'
import config from '../../../next.config'

test('en-tête noindex sur les pages concours', async () => {
  const rules = await config.headers!()
  const rule = rules.find((r) => r.source === '/concours/:path*')
  expect(rule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/concours src/app/__tests__/robots.test.ts src/app/__tests__/next-config.test.ts`
Expected: FAIL — routes absentes, `/concours/` absent de robots, `config.headers` indéfini.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/concours/[secret]/etat/route.ts
import { loadGuestView } from '@/lib/contest-views'

// Interrogée toutes les 2,5 s par chaque téléphone. no-store : un état périmé
// servi par un cache intermédiaire figerait l'écran d'un invité.
const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export async function GET(_request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  const view = await loadGuestView(secret)
  if (!view) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS })
  return Response.json(view, { headers: HEADERS })
}
```

```ts
// src/app/api/admin/concours/[id]/etat/route.ts
import { isAdmin } from '@/lib/auth'
import { loadAdminView } from '@/lib/contest-views'

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: HEADERS })
  const id = Number((await params).id)
  const view = Number.isInteger(id) ? await loadAdminView(id) : null
  if (!view) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS })
  return Response.json(view, { headers: HEADERS })
}
```

```ts
// src/app/concours/layout.tsx
import type { Metadata } from 'next'

// Partie privée du site, atteinte par QR code (spec §5) : jamais indexée, même
// si une URL fuitait. Doublé par l'en-tête X-Robots-Tag de next.config.ts.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function ContestLayout({ children }: LayoutProps<'/concours'>) {
  return children
}
```

Modifier `src/app/robots.ts` :

```ts
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/concours/'] },
```

Remplacer `next.config.ts` par :

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Concours (spec 2026-09-25 §5) : ceinture en plus de la balise meta, pour
  // que même une réponse non-HTML ou une erreur porte l'interdiction d'indexer.
  async headers() {
    return [
      { source: "/concours/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx next typegen` (nouvelle route `/concours` pour `LayoutProps`), puis `npx vitest run src/app/api/concours src/app/__tests__/robots.test.ts src/app/__tests__/next-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/concours src/app/api/admin src/app/concours/layout.tsx src/app/robots.ts next.config.ts src/app/__tests__/robots.test.ts src/app/__tests__/next-config.test.ts
git commit -m "feat(concours): routes d'état pour le polling et non-indexation"
```

---

### Task 8: Dictionnaire bilingue et briques client (polling, langue)

**Files:**
- Create: `src/lib/contest-i18n.ts`, `src/components/contest/usePolling.ts`, `src/components/contest/useContestLang.ts`
- Test: `src/lib/__tests__/contest-i18n.test.ts`, `src/components/contest/__tests__/use-polling.test.tsx`

**Interfaces:**
- Produces:
  - `contest-i18n.ts` : `type ContestMsgKey`, `contestDict: Record<Lang, Record<ContestMsgKey, string>>`, `fmt(template: string, vars: Record<string, string | number>): string`
  - `usePolling<T>(url: string, initial: T, intervalMs?: number): { data: T; refresh: () => Promise<void>; offline: boolean; gone: boolean }` (`gone` = la route a répondu 404)
  - `useContestLang(): { ready: boolean; lang: Lang | null; setLang: (l: Lang) => void; t: (k: ContestMsgKey, vars?: Record<string, string | number>) => string }` — clé localStorage `cc_concours_lang`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/contest-i18n.test.ts
import { expect, test } from 'vitest'
import { contestDict, fmt } from '../contest-i18n'

test('FR et EN ont exactement les mêmes clés, aucune vide', () => {
  expect(Object.keys(contestDict.en).sort()).toEqual(Object.keys(contestDict.fr).sort())
  for (const lang of ['fr', 'en'] as const) {
    for (const v of Object.values(contestDict[lang])) expect(v.trim()).not.toBe('')
  }
})

test('fmt remplace les variables', () => {
  expect(fmt('Assiette {n} — {who}', { n: 4, who: 'Julie' })).toBe('Assiette 4 — Julie')
})
```

```tsx
// src/components/contest/__tests__/use-polling.test.tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { usePolling } from '../usePolling'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('rafraîchit périodiquement et signale le hors-ligne', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ n: 2 }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))
  expect(result.current.data).toEqual({ n: 1 })
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.data).toEqual({ n: 2 })
  fetchMock.mockRejectedValue(new TypeError('offline'))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.offline).toBe(true)
})

test('404 → gone', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
  const { result } = renderHook(() => usePolling('/api/x', { n: 1 }, 1000))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.gone).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/contest-i18n.test.ts src/components/contest`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/contest-i18n.ts
// Textes du parcours invité (spec §8). Séparés de i18n.ts : la carte et le
// concours n'évoluent pas ensemble. `{x}` = variable remplacée par fmt().
import type { Lang } from './i18n'

const fr = {
  chooseLang: 'Choisis ta langue',
  whoAreYou: 'Qui es-tu ?',
  whoHint: 'Choisis ton nom dans la liste.',
  takenHint: 'Déjà utilisé sur un autre téléphone — demande à l’organisateur.',
  confirmName: 'Tu es bien {name} ?',
  confirm: 'C’est moi',
  cancel: 'Annuler',
  released: 'Ton nom a été libéré : choisis-le à nouveau.',
  hello: 'Salut {name}',
  notMe: 'Ce n’est pas moi',
  waitingTitle: 'Le concours n’a pas encore commencé',
  waitingBody: 'Cet écran changera tout seul quand les votes seront ouverts.',
  toTaste: 'À goûter',
  toTasteHint: 'Touche une assiette que tu as goûtée, puis choisis sa place.',
  myRanking: 'Mon classement',
  emptyRanking: 'Rien pour l’instant : goûte une assiette et place-la ici.',
  placeHere: 'Placer ici',
  cancelPlace: 'Annuler',
  remove: 'Retirer',
  moveUp: 'Monter',
  moveDown: 'Descendre',
  plate: 'Assiette {n}',
  allRanked: 'Ton classement est complet',
  platesLeft: 'Encore {n} à goûter',
  offline: 'Hors ligne — ton classement sera envoyé au retour du réseau.',
  saveFailed: 'Enregistrement impossible, nouvel essai en cours…',
  eyesOnScreen: 'Les yeux sur l’écran !',
  closedBody: 'Les votes sont clos. Le verdict arrive.',
  resultsTitle: 'Le classement',
  yourPalate: 'Ton palais',
  agreement: 'Tu es à {n} % en phase avec la tablée',
  yourPick: 'Ton classement',
  finalRank: 'Classement final',
  yourPlates: 'Tes cookies',
  rank: '{n}e',
  firstRank: '1er',
  score: '{n}/100',
  avgRank: 'rang moyen {n}',
  votes: '{n} voix',
  bestWorst: 'meilleure place {best}, pire place {worst}',
  firsts: 'mis 1er par {n} personne(s)',
  unranked: 'Non classée',
  notFound: 'Ce concours n’existe plus.',
}

const en: Record<keyof typeof fr, string> = {
  chooseLang: 'Choose your language',
  whoAreYou: 'Who are you?',
  whoHint: 'Pick your name from the list.',
  takenHint: 'Already used on another phone — ask the host.',
  confirmName: 'Are you {name}?',
  confirm: 'That’s me',
  cancel: 'Cancel',
  released: 'Your name was released: pick it again.',
  hello: 'Hi {name}',
  notMe: 'Not me',
  waitingTitle: 'The contest hasn’t started yet',
  waitingBody: 'This screen will update by itself when voting opens.',
  toTaste: 'To taste',
  toTasteHint: 'Tap a plate you tasted, then choose its spot.',
  myRanking: 'My ranking',
  emptyRanking: 'Nothing yet: taste a plate and place it here.',
  placeHere: 'Place here',
  cancelPlace: 'Cancel',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  plate: 'Plate {n}',
  allRanked: 'Your ranking is complete',
  platesLeft: '{n} left to taste',
  offline: 'Offline — your ranking will be sent when you’re back online.',
  saveFailed: 'Couldn’t save, retrying…',
  eyesOnScreen: 'Eyes on the screen!',
  closedBody: 'Voting is closed. The verdict is coming.',
  resultsTitle: 'The ranking',
  yourPalate: 'Your palate',
  agreement: 'You’re {n}% in tune with the table',
  yourPick: 'Your ranking',
  finalRank: 'Final ranking',
  yourPlates: 'Your cookies',
  rank: '#{n}',
  firstRank: '#1',
  score: '{n}/100',
  avgRank: 'avg. rank {n}',
  votes: '{n} votes',
  bestWorst: 'best spot {best}, worst spot {worst}',
  firsts: 'ranked #1 by {n} guest(s)',
  unranked: 'Unranked',
  notFound: 'This contest no longer exists.',
}

export type ContestMsgKey = keyof typeof fr
export const contestDict: Record<Lang, Record<ContestMsgKey, string>> = { fr, en }

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
```

```ts
// src/components/contest/usePolling.ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Synchronisation du concours (spec §7) : on relit l'état entier toutes les
// 2,5 s. Onglet caché → pause (batterie) ; retour au premier plan → relecture
// immédiate, pour qu'un téléphone sorti de veille rattrape la phase en cours.
export function usePolling<T>(url: string, initial: T, intervalMs = 2500) {
  const [data, setData] = useState<T>(initial)
  const [offline, setOffline] = useState(false)
  const [gone, setGone] = useState(false)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch(url, { cache: 'no-store' })
      setOffline(false)
      if (res.status === 404) setGone(true)
      else if (res.ok) setData((await res.json()) as T)
    } catch {
      setOffline(true)
    } finally {
      inFlight.current = false
    }
  }, [url])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, intervalMs])

  return { data, refresh, offline, gone }
}
```

```ts
// src/components/contest/useContestLang.ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { contestDict, fmt, type ContestMsgKey } from '@/lib/contest-i18n'
import type { Lang } from '@/lib/i18n'

const KEY = 'cc_concours_lang'

// Langue du concours, CHOISIE explicitement au premier écran (spec §8) — d'où
// une clé distincte de celle de la carte (cmtl_lang), qui, elle, se devine.
// `ready` évite de flasher le sélecteur de langue avant la lecture du stockage.
export function useContestLang() {
  const [lang, setLangState] = useState<Lang | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'fr' || stored === 'en') setLangState(stored)
    setReady(true)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(KEY, l)
  }, [])

  const t = useCallback(
    (k: ContestMsgKey, vars?: Record<string, string | number>) => {
      const s = contestDict[lang ?? 'fr'][k]
      return vars ? fmt(s, vars) : s
    },
    [lang],
  )

  return { ready, lang, setLang, t }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/contest-i18n.test.ts src/components/contest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contest-i18n.ts src/lib/__tests__/contest-i18n.test.ts src/components/contest
git commit -m "feat(concours): textes FR/EN, polling et langue du concours"
```

---

### Task 9: Tableau de classement (`RankingBoard`)

**Files:**
- Create: `src/components/contest/RankingBoard.tsx`
- Modify: `package.json` / `package-lock.json` (dépendances)
- Test: `src/components/contest/__tests__/ranking-board.test.tsx`

**Interfaces:**
- Consumes: `placeAt`, `removeFrom`, `moveBy` (Task 2) ; `ContestMsgKey` (Task 8).
- Produces: `RankingBoard(props: { plates: { id: number; number: number; label: string | null }[]; ranking: number[]; onChange: (next: number[]) => void; locked: boolean; t: (k: ContestMsgKey, vars?: Record<string, string | number>) => string })` — composant contrôlé : il n'enregistre rien lui-même.

Choix d'interaction (précise la spec §8) : depuis « À goûter », on **touche** une pastille puis un emplacement « Placer ici » — fiable au doigt sur iOS. Le **glisser-déposer** sert à réordonner « Mon classement » (plus les boutons Monter/Descendre). Le glisser d'une zone à l'autre n'est pas implémenté : il doublerait le code dnd-kit pour un geste déjà couvert par le toucher.

- [ ] **Step 1: Install dependencies**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: ajout sans conflit de peer dependencies avec React 19.

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/contest/__tests__/ranking-board.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { contestDict, fmt, type ContestMsgKey } from '@/lib/contest-i18n'
import { RankingBoard } from '../RankingBoard'

const t = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
const plates = [
  { id: 10, number: 1, label: null },
  { id: 20, number: 2, label: 'Noisette' },
  { id: 30, number: 3, label: null },
]

test('classement vide au départ, toutes les assiettes à goûter', () => {
  render(<RankingBoard plates={plates} ranking={[]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByText(contestDict.fr.emptyRanking)).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /Assiette \d/ })).toHaveLength(3)
})

test('toucher une assiette puis « Placer ici » l’insère à cet endroit', () => {
  const onChange = vi.fn()
  render(<RankingBoard plates={plates} ranking={[10, 30]} onChange={onChange} locked={false} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'Assiette 2' }))
  const slots = screen.getAllByRole('button', { name: 'Placer ici' })
  expect(slots).toHaveLength(3)
  fireEvent.click(slots[1])
  expect(onChange).toHaveBeenCalledWith([10, 20, 30])
})

test('monter, retirer', () => {
  const onChange = vi.fn()
  render(<RankingBoard plates={plates} ranking={[10, 30]} onChange={onChange} locked={false} t={t} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Monter' })[1])
  expect(onChange).toHaveBeenLastCalledWith([30, 10])
  fireEvent.click(screen.getAllByRole('button', { name: 'Retirer' })[0])
  expect(onChange).toHaveBeenLastCalledWith([30])
})

test('verrouillé : aucune commande', () => {
  render(<RankingBoard plates={plates} ranking={[10]} onChange={vi.fn()} locked t={t} />)
  expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Assiette 2/ })).toBeNull()
})

test('une assiette supprimée disparaît du classement affiché', () => {
  render(<RankingBoard plates={plates.slice(0, 2)} ranking={[30, 10]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.queryByText('Assiette 3')).toBeNull()
})

test('indicateur de progression', () => {
  const { rerender } = render(<RankingBoard plates={plates} ranking={[10]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByText('Encore 2 à goûter')).toBeTruthy()
  rerender(<RankingBoard plates={plates} ranking={[10, 20, 30]} onChange={vi.fn()} locked={false} t={t} />)
  expect(screen.getByText(contestDict.fr.allRanked)).toBeTruthy()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/contest/__tests__/ranking-board.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Write the implementation**

```tsx
// src/components/contest/RankingBoard.tsx
'use client'

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { IconCheck, IconClose } from '@/components/icons'
import type { ContestMsgKey } from '@/lib/contest-i18n'
import { moveBy, placeAt, removeFrom } from '@/lib/contest-ranking'

type Plate = { id: number; number: number; label: string | null }
type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

type Props = { plates: Plate[]; ranking: number[]; onChange: (next: number[]) => void; locked: boolean; t: T }

export function RankingBoard({ plates, ranking, onChange, locked, t }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const byId = new Map(plates.map((p) => [p.id, p]))
  // Une assiette supprimée par l'admin disparaît d'elle-même (spec §11).
  const ranked = ranking.filter((id) => byId.has(id))
  const pool = plates.filter((p) => !ranked.includes(p.id))

  // Appui long de 200 ms avant de saisir une ligne au doigt : sans ce délai, le
  // simple défilement de la page déclencherait des glisser involontaires.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onChange(arrayMove(ranked, ranked.indexOf(Number(active.id)), ranked.indexOf(Number(over.id))))
  }

  const place = (index: number) => {
    if (picked === null) return
    onChange(placeAt(ranked, picked, index))
    setPicked(null)
  }

  const slot = (index: number) =>
    picked !== null && (
      <button
        key={`slot-${index}`}
        type="button"
        onClick={() => place(index)}
        className="w-full rounded-[var(--radius-field)] border-2 border-dashed border-[color:var(--accent)] py-2 text-[14px] font-medium text-[color:var(--accent-ink)]"
      >
        {t('placeHere')}
      </button>
    )

  return (
    <div className="flex flex-col gap-6">
      {!locked && pool.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('toTaste')}</h2>
          <p className="text-[13px] text-[color:var(--text-muted)]">{t('toTasteHint')}</p>
          <div className="flex flex-wrap gap-2">
            {pool.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={picked === p.id}
                onClick={() => setPicked(picked === p.id ? null : p.id)}
                className={`rounded-full border px-4 py-2 text-[15px] ${
                  picked === p.id
                    ? 'border-[color:var(--accent)] bg-[color:var(--btn-bg)] text-[color:var(--btn-text)]'
                    : 'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--text-strong)]'
                }`}
              >
                {t('plate', { n: p.number })}
              </button>
            ))}
          </div>
          {picked !== null && (
            <button type="button" onClick={() => setPicked(null)} className="self-start text-[13px] text-[color:var(--text-muted)] underline">
              {t('cancelPlace')}
            </button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('myRanking')}</h2>
        {ranked.length === 0 && picked === null && (
          <p className="rounded-[var(--radius-card)] border border-dashed border-[color:var(--border-strong)] p-4 text-[14px] text-[color:var(--text-muted)]">
            {t('emptyRanking')}
          </p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2">
              {slot(0)}
              {ranked.map((id, i) => (
                <li key={id} className="flex flex-col gap-2">
                  <RankedRow
                    plate={byId.get(id)!}
                    index={i}
                    count={ranked.length}
                    locked={locked}
                    t={t}
                    onUp={() => onChange(moveBy(ranked, id, -1))}
                    onDown={() => onChange(moveBy(ranked, id, 1))}
                    onRemove={() => onChange(removeFrom(ranked, id))}
                  />
                  {slot(i + 1)}
                </li>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </section>

      {!locked && (
        <p className="flex items-center gap-2 text-[14px] text-[color:var(--text-body)]">
          {pool.length === 0 ? (
            <>
              <IconCheck size={16} />
              {t('allRanked')}
            </>
          ) : (
            t('platesLeft', { n: pool.length })
          )}
        </p>
      )}
    </div>
  )
}

type RowProps = {
  plate: Plate; index: number; count: number; locked: boolean; t: T
  onUp: () => void; onDown: () => void; onRemove: () => void
}

function RankedRow({ plate, index, count, locked, t, onUp, onDown, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plate.id, disabled: locked })
  const btn = 'rounded-full px-2.5 py-1.5 text-[13px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)] disabled:opacity-30'
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-chip)] ${isDragging ? 'relative z-10 opacity-90' : ''}`}
    >
      <span className="font-display w-8 text-center text-[20px] text-[color:var(--accent-ink)]">{index + 1}</span>
      <div {...attributes} {...listeners} className="flex-1 touch-none select-none">
        <div className="text-[16px] font-medium text-[color:var(--text-strong)]">{t('plate', { n: plate.number })}</div>
        {plate.label && <div className="text-[13px] text-[color:var(--text-muted)]">{plate.label}</div>}
      </div>
      {!locked && (
        <div className="flex items-center">
          <button type="button" aria-label={t('moveUp')} onClick={onUp} disabled={index === 0} className={btn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
          <button type="button" aria-label={t('moveDown')} onClick={onDown} disabled={index === count - 1} className={btn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <button type="button" aria-label={t('remove')} onClick={onRemove} className={btn}>
            <IconClose size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
```

Note : `useSortable` pose `role="button"` sur la poignée d'une ligne classée, dont le nom accessible est « Assiette N ». Les tests visent donc des noms exacts d'assiettes NON classées (« Assiette 2 » quand le classement est `[10, 30]`), ou un classement vide pour compter les pastilles.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/contest/__tests__/ranking-board.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/contest/RankingBoard.tsx src/components/contest/__tests__/ranking-board.test.tsx
git commit -m "feat(concours): classement au fil de la dégustation (toucher pour placer, glisser pour réordonner)"
```

---

### Task 10: Page et parcours invité

**Files:**
- Create: `src/app/concours/[secret]/page.tsx`, `src/components/contest/ContestGuestApp.tsx`, `src/components/contest/LanguagePicker.tsx`, `src/components/contest/NamePicker.tsx`, `src/components/contest/GuestResults.tsx`
- Test: `src/components/contest/__tests__/guest-app.test.tsx`

**Interfaces:**
- Consumes: `loadGuestView`, `GuestView`, `ResultRow` (Tasks 3–4) ; `claimNameAction`, `saveBallotAction` (Task 5) ; `usePolling`, `useContestLang` (Task 8) ; `RankingBoard` (Task 9).
- Produces: `ContestGuestApp({ secret: string; initial: GuestView })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/contest/__tests__/guest-app.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { GuestView } from '@/lib/contest-state'

const claimNameAction = vi.fn()
const saveBallotAction = vi.fn()
vi.mock('@/app/actions/contest-guest', () => ({
  claimNameAction: (...a: unknown[]) => claimNameAction(...a),
  saveBallotAction: (...a: unknown[]) => saveBallotAction(...a),
}))

import { ContestGuestApp } from '../ContestGuestApp'

const base: GuestView = {
  name: 'Anniv', phase: 'voting', final: false, me: null,
  guests: [{ id: 1, name: 'Julie', taken: false }, { id: 2, name: 'Marc', taken: true }],
  plates: [{ id: 10, number: 1, label: null }], myBallot: [], results: null,
}

beforeEach(() => {
  localStorage.clear()
  claimNameAction.mockReset().mockResolvedValue({ ok: true })
  saveBallotAction.mockReset().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(base))))
})

test('premier écran : choix de la langue, mémorisé', async () => {
  render(<ContestGuestApp secret="s" initial={base} />)
  fireEvent.click(await screen.findByRole('button', { name: 'English' }))
  expect(localStorage.getItem('cc_concours_lang')).toBe('en')
  expect(await screen.findByText('Who are you?')).toBeTruthy()
})

test('choix du nom : nom pris désactivé, confirmation puis action', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={base} />)
  expect((await screen.findByRole('button', { name: /Marc/ })).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Julie' }))
  fireEvent.click(screen.getByRole('button', { name: 'C’est moi' }))
  await waitFor(() => expect(claimNameAction).toHaveBeenCalledWith('s', 1))
})

test('identifié en phase de vote : le classement s’affiche', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, me: { id: 1, name: 'Julie' } }} />)
  expect(await screen.findByText('Mon classement')).toBeTruthy()
})

test('révélation en cours : rien n’est dévoilé', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, phase: 'reveal', me: { id: 1, name: 'Julie' } }} />)
  expect(await screen.findByText('Les yeux sur l’écran !')).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/contest/__tests__/guest-app.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write the components**

```tsx
// src/components/contest/LanguagePicker.tsx
'use client'

import type { Lang } from '@/lib/i18n'

// Premier écran (spec §8), volontairement bilingue lui-même : on ne sait pas
// encore quelle langue lit la personne.
export function LanguagePicker({ onPick }: { onPick: (l: Lang) => void }) {
  const btn = 'w-full rounded-[var(--radius-card)] bg-[color:var(--btn-bg)] px-6 py-5 text-[20px] font-medium text-[color:var(--btn-text)] hover:bg-[color:var(--btn-bg-hover)]'
  return (
    <div className="flex flex-col items-center gap-6 pt-16">
      <h1 className="font-display text-center text-[26px] leading-tight text-[color:var(--text-strong)]">
        Choisis ta langue
        <br />
        Choose your language
      </h1>
      <button type="button" className={btn} onClick={() => onPick('fr')}>Français</button>
      <button type="button" className={btn} onClick={() => onPick('en')}>English</button>
    </div>
  )
}
```

```tsx
// src/components/contest/NamePicker.tsx
'use client'

import { useState } from 'react'
import type { ContestMsgKey } from '@/lib/contest-i18n'
import type { GuestView } from '@/lib/contest-state'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

export function NamePicker({ guests, onClaim, t, notice }: {
  guests: GuestView['guests']; onClaim: (id: number) => Promise<void>; t: T; notice: string | null
}) {
  const [pending, setPending] = useState<{ id: number; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (pending) {
    return (
      <div className="flex flex-col gap-4 pt-10">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{t('confirmName', { name: pending.name })}</h1>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onClaim(pending.id)
            setBusy(false)
            setPending(null)
          }}
          className="rounded-[var(--radius-card)] bg-[color:var(--btn-bg)] px-6 py-4 text-[18px] font-medium text-[color:var(--btn-text)] disabled:opacity-60"
        >
          {t('confirm')}
        </button>
        <button type="button" onClick={() => setPending(null)} className="text-[15px] text-[color:var(--text-muted)] underline">
          {t('cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pt-6">
      <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('whoAreYou')}</h1>
      <p className="text-[14px] text-[color:var(--text-muted)]">{t('whoHint')}</p>
      {notice && <p className="rounded-[var(--radius-field)] bg-[color:var(--accent-wash)] p-3 text-[14px] text-[color:var(--text-body)]">{notice}</p>}
      <ul className="flex flex-col gap-2">
        {guests.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              disabled={g.taken}
              onClick={() => setPending({ id: g.id, name: g.name })}
              className="flex w-full flex-col items-start rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-left text-[17px] text-[color:var(--text-strong)] disabled:opacity-50"
            >
              {g.name}
              {g.taken && <span className="text-[12px] text-[color:var(--text-muted)]">{t('takenHint')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// src/components/contest/GuestResults.tsx
'use client'

import type { ContestMsgKey } from '@/lib/contest-i18n'
import type { GuestView, ResultRow } from '@/lib/contest-state'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

function rankLabel(t: T, position: number | null) {
  if (position === null) return t('unranked')
  return position === 1 ? t('firstRank') : t('rank', { n: position })
}

function Row({ row, t }: { row: ResultRow; t: T }) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <span className="font-display w-10 text-center text-[18px] text-[color:var(--accent-ink)]">{rankLabel(t, row.position)}</span>
      <div className="flex-1">
        <div className="text-[16px] font-medium text-[color:var(--text-strong)]">
          {t('plate', { n: row.number })}
          {row.authors.length > 0 && <span className="font-normal text-[color:var(--text-body)]"> — {row.authors.join(' & ')}</span>}
        </div>
        {row.score !== null && (
          <div className="text-[13px] text-[color:var(--text-muted)]">
            {t('score', { n: row.score })} · {t('avgRank', { n: row.avgRank!.toFixed(1) })}
          </div>
        )}
      </div>
    </li>
  )
}

export function GuestResults({ results, myBallot, t }: { results: NonNullable<GuestView['results']>; myBallot: number[]; t: T }) {
  const byId = new Map(results.rows.map((r) => [r.plateId, r]))
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('resultsTitle')}</h1>
        <ol className="flex flex-col gap-2">
          {results.rows.map((r) => <Row key={r.plateId} row={r} t={t} />)}
        </ol>
      </section>

      {myBallot.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[22px] text-[color:var(--text-strong)]">{t('yourPalate')}</h2>
          {results.agreement !== null && <p className="text-[15px] text-[color:var(--text-body)]">{t('agreement', { n: results.agreement })}</p>}
          <table className="w-full text-[14px] text-[color:var(--text-body)]">
            <thead>
              <tr className="text-left text-[12px] text-[color:var(--text-muted)]">
                <th className="py-1">{t('yourPick')}</th>
                <th className="py-1">{t('finalRank')}</th>
              </tr>
            </thead>
            <tbody>
              {myBallot.map((id, i) => (
                <tr key={id} className="border-t border-[color:var(--border)]">
                  <td className="py-1.5">{i + 1}. {t('plate', { n: byId.get(id)?.number ?? '?' })}</td>
                  <td className="py-1.5">{rankLabel(t, byId.get(id)?.position ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results.myPlates.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[22px] text-[color:var(--text-strong)]">{t('yourPlates')}</h2>
          {results.myPlates.map((r) => (
            <div key={r.plateId} className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-[14px] text-[color:var(--text-body)]">
              <div className="font-display text-[20px] text-[color:var(--text-strong)]">
                {t('plate', { n: r.number })} — {rankLabel(t, r.position)}
              </div>
              {r.score !== null ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  <li>{t('score', { n: r.score })} · {t('votes', { n: r.votes })}</li>
                  <li>{t('bestWorst', { best: r.bestRank!, worst: r.worstRank! })}</li>
                  <li>{t('firsts', { n: r.firsts })}</li>
                </ul>
              ) : (
                <p>{t('unranked')}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
```

```tsx
// src/components/contest/ContestGuestApp.tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { claimNameAction, saveBallotAction } from '@/app/actions/contest-guest'
import type { GuestView } from '@/lib/contest-state'
import { GuestResults } from './GuestResults'
import { LanguagePicker } from './LanguagePicker'
import { NamePicker } from './NamePicker'
import { RankingBoard } from './RankingBoard'
import { useContestLang } from './useContestLang'
import { usePolling } from './usePolling'

export function ContestGuestApp({ secret, initial }: { secret: string; initial: GuestView }) {
  const { ready, lang, setLang, t } = useContestLang()
  const { data: view, refresh, offline, gone } = usePolling<GuestView>(`/api/concours/${secret}/etat`, initial)

  // Le classement vit localement pendant qu'on l'édite : le polling ne doit pas
  // l'écraser avec une version serveur en retard d'un aller-retour. Il n'est
  // repris du serveur qu'au changement d'identité.
  const [ranking, setRanking] = useState<number[]>(initial.myBallot)
  const [saveError, setSaveError] = useState(false)
  const unsent = useRef<number[] | null>(null)
  const meId = view.me?.id ?? null
  const hadIdentity = useRef(initial.me !== null)
  const [released, setReleased] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRanking(view.myBallot)
    if (meId === null && hadIdentity.current) setReleased(true)
    hadIdentity.current = meId !== null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId])

  const send = async (next: number[]) => {
    unsent.current = next
    try {
      const res = await saveBallotAction(secret, next)
      if (unsent.current === next) unsent.current = null
      setSaveError(!res.ok && res.error !== 'closed')
      if (!res.ok) void refresh()
    } catch {
      setSaveError(true)
    }
  }

  // Au retour du réseau, on renvoie le dernier état complet (spec §11).
  useEffect(() => {
    const onOnline = () => {
      if (unsent.current) void send(unsent.current)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  })
  useEffect(() => {
    if (!offline && unsent.current) void send(unsent.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline])

  const onChange = (next: number[]) => {
    setRanking(next)
    void send(next)
  }

  const claim = async (id: number) => {
    await claimNameAction(secret, id)
    setReleased(false)
    await refresh()
  }

  let body: ReactNode
  if (!ready) body = null
  else if (gone) body = <p className="pt-16 text-center text-[16px] text-[color:var(--text-body)]">{t('notFound')}</p>
  else if (!lang) body = <LanguagePicker onPick={setLang} />
  else if (!view.me) body = <NamePicker guests={view.guests} onClaim={claim} t={t} notice={released ? t('released') : null} />
  else if (view.phase === 'preparation') {
    body = (
      <div className="pt-16 text-center">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{t('waitingTitle')}</h1>
        <p className="mt-2 text-[15px] text-[color:var(--text-body)]">{t('waitingBody')}</p>
      </div>
    )
  } else if (view.final && view.results) {
    body = <GuestResults results={view.results} myBallot={view.myBallot} t={t} />
  } else if (view.phase === 'voting') {
    body = <RankingBoard plates={view.plates} ranking={ranking} onChange={onChange} locked={false} t={t} />
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <div className="pt-6 text-center">
          <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('eyesOnScreen')}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--text-body)]">{t('closedBody')}</p>
        </div>
        <RankingBoard plates={view.plates} ranking={ranking} onChange={() => {}} locked t={t} />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-[color:var(--bg)] px-4 pb-10 pt-4">
      <header className="flex items-center justify-between gap-3">
        <span className="font-display truncate text-[16px] text-[color:var(--text-muted)]">{view.name}</span>
        {lang && (
          <div className="flex items-center gap-3">
            {view.me && <span className="text-[13px] text-[color:var(--text-body)]">{t('hello', { name: view.me.name })}</span>}
            <button type="button" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[12px] text-[color:var(--text-body)]">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </div>
        )}
      </header>
      {(offline || saveError) && lang && (
        <p role="status" className="rounded-[var(--radius-field)] bg-[color:var(--accent-wash)] p-3 text-[13px] text-[color:var(--text-body)]">
          {offline ? t('offline') : t('saveFailed')}
        </p>
      )}
      {body}
    </main>
  )
}
```

- [ ] **Step 4: Write the page**

```tsx
// src/app/concours/[secret]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ContestGuestApp } from '@/components/contest/ContestGuestApp'
import { loadGuestView } from '@/lib/contest-views'

export const metadata: Metadata = { title: 'Concours — Cookies Club', robots: { index: false, follow: false } }

export default function ContestGuestPage({ params }: PageProps<'/concours/[secret]'>) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[color:var(--bg)]" />}>
      <Guest params={params} />
    </Suspense>
  )
}

async function Guest({ params }: { params: PageProps<'/concours/[secret]'>['params'] }) {
  const { secret } = await params
  const view = await loadGuestView(secret)
  // Secret faux ou concours supprimé : 404 nu, rien qui confirme qu'un concours a existé.
  if (!view) notFound()
  return <ContestGuestApp secret={secret} initial={view} />
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx next typegen && npx vitest run src/components/contest && npx tsc --noEmit`
Expected: PASS, aucune erreur de type.

- [ ] **Step 6: Commit**

```bash
git add src/app/concours src/components/contest
git commit -m "feat(concours): parcours invité — langue, nom, attente, classement, récapitulatif"
```

---

### Task 11: Admin — liste, pilotage, QR code et scène

**Files:**
- Create: `src/app/admin/concours/page.tsx`, `src/app/admin/concours/[id]/page.tsx`, `src/app/admin/concours/[id]/scene/page.tsx`, `src/components/admin/contest/ContestList.tsx`, `src/components/admin/contest/ContestControl.tsx`, `src/components/admin/contest/GuestPanel.tsx`, `src/components/admin/contest/PlatePanel.tsx`, `src/components/admin/contest/PilotPanel.tsx`, `src/components/admin/contest/ContestQr.tsx`, `src/components/admin/contest/Scene.tsx`
- Modify: `src/components/admin/AdminHeader.tsx`, `src/components/admin/__tests__/admin-header.test.tsx`
- Test: `src/components/admin/contest/__tests__/contest-list.test.tsx`, `src/components/admin/contest/__tests__/scene.test.tsx`

**Interfaces:**
- Consumes: toutes les actions admin (Task 6) ; `listContests`, `ContestSummary` (Task 4) ; `loadAdminView`, `AdminView`, `ResultRow`, `RevealStep` (Tasks 2–4) ; `usePolling` (Task 8) ; `isAdmin`, `isDevPasswordBypass`, `LoginForm`.
- Produces: pages `/admin/concours`, `/admin/concours/[id]`, `/admin/concours/[id]/scene`.

- [ ] **Step 1: Install QR dependency**

Run: `npm install qrcode && npm install -D @types/qrcode`

- [ ] **Step 2: Write the failing tests**

```tsx
// src/components/admin/contest/__tests__/contest-list.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const createContestAction = vi.fn()
const deleteContestAction = vi.fn()
const push = vi.fn()
const refresh = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({
  createContestAction: (...a: unknown[]) => createContestAction(...a),
  deleteContestAction: (...a: unknown[]) => deleteContestAction(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

import { ContestList } from '../ContestList'

const contests = [{ id: 3, name: 'Anniv Léo', phase: 'voting' as const, guestCount: 12, createdAt: '2026-09-25T00:00:00.000Z' }]

beforeEach(() => {
  createContestAction.mockReset().mockResolvedValue({ ok: true, id: 9 })
  deleteContestAction.mockReset().mockResolvedValue({ ok: true })
  push.mockReset()
  refresh.mockReset()
})

test('créer un concours ouvre son pilotage', async () => {
  render(<ContestList contests={[]} />)
  fireEvent.change(screen.getByPlaceholderText('Nom du concours'), { target: { value: 'Anniv' } })
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
  await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/concours/9'))
})

test('suppression : il faut retaper le nom exact', async () => {
  render(<ContestList contests={contests} />)
  fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  const confirm = screen.getByRole('button', { name: 'Supprimer définitivement' })
  expect(confirm.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByPlaceholderText('Anniv Léo'), { target: { value: 'Anniv Léo' } })
  fireEvent.click(confirm)
  await waitFor(() => expect(deleteContestAction).toHaveBeenCalledWith(3))
})
```

```tsx
// src/components/admin/contest/__tests__/scene.test.tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { AdminView } from '@/lib/contest-state'

vi.mock('@/app/actions/contest-admin', () => ({ setRevealStepAction: vi.fn().mockResolvedValue({ ok: true }) }))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))

import { Scene } from '../Scene'

const row = (plateId: number, number: number, position: number, score: number, authors: string[]) => ({
  plateId, number, label: null, authors, position, score, avgRank: position, votes: 3, bestRank: 1, worstRank: 3, firsts: 0,
})

const view = (revealStep: number): AdminView => ({
  contest: { id: 1, name: 'Anniv', secret: 's', phase: 'reveal', revealStep },
  guests: [], plates: [],
  rows: [row(10, 1, 1, 80, ['Julie']), row(20, 2, 2, 60, ['Marc'])],
  steps: [
    { kind: 'title' },
    { kind: 'plate', plateIds: [20], position: 2, showAuthors: false, podium: true },
    { kind: 'plate', plateIds: [20], position: 2, showAuthors: true, podium: true },
    { kind: 'plate', plateIds: [10], position: 1, showAuthors: false, podium: true },
    { kind: 'plate', plateIds: [10], position: 1, showAuthors: true, podium: true },
    { kind: 'final' },
  ],
  complete: 0,
})

test('étape « note » : numéro et note, sans auteur', () => {
  render(<Scene initial={view(3)} />)
  expect(screen.getByText('80')).toBeTruthy()
  expect(screen.queryByText(/Julie/)).toBeNull()
  expect(screen.getByText(/\+20/)).toBeTruthy()
})

test('étape « auteurs » : le nom apparaît', () => {
  render(<Scene initial={view(4)} />)
  expect(screen.getByText(/Julie/)).toBeTruthy()
})

test('hors phase reveal : écran d’attente', () => {
  const v = view(0)
  render(<Scene initial={{ ...v, contest: { ...v.contest, phase: 'closed' } }} />)
  expect(screen.getByText(/en attente/i)).toBeTruthy()
})
```

Ajouter à `src/components/admin/__tests__/admin-header.test.tsx` :

```tsx
test('lien Concours vers la section concours, même onglet', () => {
  render(<AdminHeader />)
  const link = screen.getByRole('link', { name: /concours/i })
  expect(link.getAttribute('href')).toBe('/admin/concours')
  expect(link.getAttribute('target')).toBeNull()
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/admin`
Expected: FAIL — modules introuvables, lien absent.

- [ ] **Step 4: Write AdminHeader link**

Dans `src/components/admin/AdminHeader.tsx`, ajouter après le lien « Voir la carte » :

```tsx
      <a
        href="/admin/concours"
        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3.5 py-2 text-[13px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)]"
      >
        Concours
      </a>
```

- [ ] **Step 5: Write ContestList + page**

```tsx
// src/components/admin/contest/ContestList.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createContestAction, deleteContestAction } from '@/app/actions/contest-admin'
import type { ContestSummary } from '@/lib/contest-db'

export const PHASE_LABEL = { preparation: 'Préparation', voting: 'Votes ouverts', closed: 'Votes clos', reveal: 'Révélation' } as const

const field = 'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] text-[color:var(--text-strong)]'
const primary = 'rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-4 py-2 text-[14px] font-medium text-[color:var(--btn-text)] hover:bg-[color:var(--btn-bg-hover)] disabled:opacity-50'

export function ContestList({ contests }: { contests: ContestSummary[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [typed, setTyped] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const res = await createContestAction(name)
    if (res.ok) router.push(`/admin/concours/${res.id}`)
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">Concours</h1>
        <a href="/admin" className="text-[13px] text-[color:var(--text-muted)] underline">Retour à l’admin</a>
      </div>
      <form onSubmit={create} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du concours" className={`${field} flex-1`} />
        <button disabled={!name.trim()} className={primary}>Créer</button>
      </form>
      <ul className="flex flex-col gap-2">
        {contests.map((c) => (
          <li key={c.id} className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="flex items-center gap-4">
              <a href={`/admin/concours/${c.id}`} className="flex-1 text-[16px] font-medium text-[color:var(--text-strong)] hover:underline">{c.name}</a>
              <span className="text-[13px] text-[color:var(--text-muted)]">
                {PHASE_LABEL[c.phase]} · {c.guestCount} invités · {new Date(c.createdAt).toLocaleDateString('fr-CA')}
              </span>
              <button type="button" onClick={() => { setDeleting(c.id); setTyped('') }} className="text-[13px] text-[color:var(--danger)]">
                Supprimer
              </button>
            </div>
            {deleting === c.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3">
                <p className="text-[13px] text-[color:var(--text-body)]">
                  Irréversible : invités, assiettes et votes seront effacés, le QR code ne mènera plus nulle part. Retape le nom pour confirmer.
                </p>
                <div className="flex gap-2">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={c.name} className={`${field} flex-1`} />
                  <button
                    type="button"
                    disabled={typed !== c.name}
                    onClick={async () => {
                      await deleteContestAction(c.id)
                      setDeleting(null)
                      router.refresh()
                    }}
                    className="rounded-[var(--radius-field)] bg-[color:var(--danger)] px-4 py-2 text-[14px] text-white disabled:opacity-40"
                  >
                    Supprimer définitivement
                  </button>
                  <button type="button" onClick={() => setDeleting(null)} className="text-[13px] text-[color:var(--text-muted)]">Annuler</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
```

```tsx
// src/app/admin/concours/page.tsx
import { Suspense } from 'react'
import { ContestList } from '@/components/admin/contest/ContestList'
import { LoginForm } from '@/components/admin/LoginForm'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { listContests } from '@/lib/contest-db'

export const metadata = { title: 'Concours — Admin', robots: { index: false, follow: false } }

export default function ContestsPage() {
  return (
    <Suspense fallback={<main className="p-6">Chargement…</main>}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  return <ContestList contests={await listContests()} />
}
```

- [ ] **Step 6: Write the control panels**

```tsx
// src/components/admin/contest/GuestPanel.tsx
'use client'

import { useState } from 'react'
import { addGuestAction, deleteGuestAction, releaseGuestAction, renameGuestAction } from '@/app/actions/contest-admin'
import type { AdminGuest } from '@/lib/contest-state'

const ERR: Record<string, string> = { name: 'Nom vide ou trop long (40 max).', 'name-taken': 'Ce nom existe déjà.' }

export function GuestPanel({ contestId, guests, onDone }: { contestId: number; guests: AdminGuest[]; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const res = await p
    setError(res.ok ? null : ERR[res.error ?? ''] ?? 'Erreur.')
    onDone()
    return res.ok
  }

  const status = (g: AdminGuest) =>
    !g.claimed ? 'libre' : g.rankable === 0 ? 'connecté' : `${g.ranked}/${g.rankable} classées`

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">Invités ({guests.length})</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await run(addGuestAction(contestId, name))) setName('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un invité puis Entrée"
          className="w-full rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px]"
        />
      </form>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}
      <ul className="flex flex-col gap-1">
        {guests.map((g) => (
          <li key={g.id} className="flex items-center gap-2 rounded-[var(--radius-field)] px-2 py-1.5 hover:bg-[color:var(--surface-2)]">
            {editing?.id === g.id ? (
              <form
                className="flex-1"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (await run(renameGuestAction(contestId, g.id, editing.name))) setEditing(null)
                }}
              >
                <input autoFocus value={editing.name} onChange={(e) => setEditing({ id: g.id, name: e.target.value })} onBlur={() => setEditing(null)} className="w-full rounded border px-2 py-1 text-[14px]" />
              </form>
            ) : (
              <button type="button" onClick={() => setEditing({ id: g.id, name: g.name })} className="flex-1 text-left text-[14px] text-[color:var(--text-strong)]">
                {g.name}
              </button>
            )}
            <span className="text-[12px] text-[color:var(--text-muted)]">{status(g)}</span>
            {g.claimed && (
              <button type="button" onClick={() => run(releaseGuestAction(contestId, g.id))} className="text-[12px] text-[color:var(--accent-ink)]">
                Libérer
              </button>
            )}
            <button type="button" onClick={() => run(deleteGuestAction(contestId, g.id))} className="text-[12px] text-[color:var(--danger)]">
              Suppr.
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```tsx
// src/components/admin/contest/PlatePanel.tsx
'use client'

import { useState } from 'react'
import { deletePlateAction, savePlateAction, shufflePlatesAction } from '@/app/actions/contest-admin'
import type { AdminGuest, PlateRow } from '@/lib/contest-state'
import type { Phase } from '@/lib/contest-rules'

const ERR: Record<string, string> = { number: 'Numéro invalide.', 'number-taken': 'Ce numéro est déjà pris.', locked: 'Mélange impossible une fois les votes ouverts.' }

type Draft = { id?: number; number: string; label: string; authorIds: number[] }

export function PlatePanel({ contestId, phase, plates, guests, onDone }: {
  contestId: number; phase: Phase; plates: PlateRow[]; guests: AdminGuest[]; onDone: () => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameOf = new Map(guests.map((g) => [g.id, g.name]))

  const save = async () => {
    if (!draft) return
    const res = await savePlateAction(contestId, {
      id: draft.id,
      number: draft.number.trim() ? Number(draft.number) : undefined,
      label: draft.label,
      authorIds: draft.authorIds,
    })
    setError(res.ok ? null : ERR[res.error] ?? 'Erreur.')
    if (res.ok) setDraft(null)
    onDone()
  }

  const toggleAuthor = (id: number) =>
    draft && setDraft({ ...draft, authorIds: draft.authorIds.includes(id) ? draft.authorIds.filter((a) => a !== id) : [...draft.authorIds, id] })

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display flex-1 text-[20px] text-[color:var(--text-strong)]">Assiettes ({plates.length})</h2>
        {phase === 'preparation' && plates.length > 1 && (
          <button type="button" onClick={async () => { const r = await shufflePlatesAction(contestId); setError(r.ok ? null : ERR[r.error]); onDone() }} className="text-[13px] text-[color:var(--accent-ink)]">
            Mélanger les numéros
          </button>
        )}
        <button type="button" onClick={() => setDraft({ number: '', label: '', authorIds: [] })} className="rounded-full bg-[color:var(--btn-bg)] px-3 py-1.5 text-[13px] text-[color:var(--btn-text)]">
          Ajouter
        </button>
      </div>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}

      {draft && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--surface)] p-3">
          <div className="flex gap-2">
            <input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="N° (auto)" inputMode="numeric" className="w-24 rounded border px-2 py-1 text-[14px]" />
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Label (facultatif)" className="flex-1 rounded border px-2 py-1 text-[14px]" />
          </div>
          <p className="text-[12px] text-[color:var(--text-muted)]">Auteurs</p>
          <div className="flex flex-wrap gap-1.5">
            {guests.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={draft.authorIds.includes(g.id)}
                onClick={() => toggleAuthor(g.id)}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${draft.authorIds.includes(g.id) ? 'border-[color:var(--accent)] bg-[color:var(--accent-wash)] text-[color:var(--text-strong)]' : 'border-[color:var(--border)] text-[color:var(--text-body)]'}`}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} className="rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-3 py-1.5 text-[13px] text-[color:var(--btn-text)]">Enregistrer</button>
            <button type="button" onClick={() => setDraft(null)} className="text-[13px] text-[color:var(--text-muted)]">Annuler</button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {plates.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-[var(--radius-field)] px-2 py-1.5 hover:bg-[color:var(--surface-2)]">
            <span className="font-display w-8 text-[18px] text-[color:var(--accent-ink)]">{p.number}</span>
            <button
              type="button"
              onClick={() => setDraft({ id: p.id, number: String(p.number), label: p.label ?? '', authorIds: p.authorIds })}
              className="flex-1 text-left text-[14px] text-[color:var(--text-strong)]"
            >
              {p.label ?? 'Sans label'}
              <span className="block text-[12px] text-[color:var(--text-muted)]">
                {p.authorIds.map((id) => nameOf.get(id)).filter(Boolean).join(' & ') || 'Aucun auteur'}
              </span>
            </button>
            <button type="button" onClick={async () => { await deletePlateAction(contestId, p.id); onDone() }} className="text-[12px] text-[color:var(--danger)]">
              Suppr.
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```tsx
// src/components/admin/contest/ContestQr.tsx
'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

// Généré dans le navigateur à partir de l'origine courante : le QR pointe vers
// le domaine réellement servi (prod, preview ou localhost), sans configuration.
// Habillage aux couleurs du thème : PR 2.
export function ContestQr({ secret }: { secret: string }) {
  const [url, setUrl] = useState('')
  const [svg, setSvg] = useState('')

  useEffect(() => {
    const u = `${window.location.origin}/concours/${secret}`
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u)
    void QRCode.toString(u, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg)
  }, [secret])

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full max-w-[220px] rounded-[var(--radius-card)] bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate text-[12px] text-[color:var(--text-muted)]">{url}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(url)} className="text-[12px] text-[color:var(--accent-ink)]">Copier</button>
      </div>
    </div>
  )
}
```

```tsx
// src/components/admin/contest/PilotPanel.tsx
'use client'

import { useState } from 'react'
import { setRevealStepAction, shiftPhaseAction } from '@/app/actions/contest-admin'
import { shiftPhase } from '@/lib/contest-rules'
import type { AdminView } from '@/lib/contest-state'
import { PHASE_LABEL } from './ContestList'
import { ContestQr } from './ContestQr'

export function PilotPanel({ view, onDone }: { view: AdminView; onDone: () => void }) {
  const { contest, rows, steps, guests, complete } = view
  const [showLive, setShowLive] = useState(false)
  const next = shiftPhase(contest.phase, 1)
  const prev = shiftPhase(contest.phase, -1)
  const btn = 'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] px-3 py-1.5 text-[13px] text-[color:var(--text-body)] disabled:opacity-40'

  const step = async (s: number) => {
    await setRevealStepAction(contest.id, s)
    onDone()
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">Pilotage</h2>
      <div className="rounded-[var(--radius-card)] bg-[color:var(--surface)] p-3">
        <p className="text-[13px] text-[color:var(--text-muted)]">Phase</p>
        <p className="text-[18px] font-medium text-[color:var(--text-strong)]">{PHASE_LABEL[contest.phase]}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className={btn} disabled={prev === contest.phase} onClick={async () => { await shiftPhaseAction(contest.id, -1); onDone() }}>
            ← {PHASE_LABEL[prev]}
          </button>
          <button type="button" className="rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--btn-text)] disabled:opacity-40" disabled={next === contest.phase} onClick={async () => { await shiftPhaseAction(contest.id, 1); onDone() }}>
            {PHASE_LABEL[next]} →
          </button>
        </div>
      </div>

      {contest.phase === 'reveal' && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-3">
          <p className="text-[13px] text-[color:var(--text-muted)]">Révélation : étape {contest.revealStep + 1}/{steps.length}</p>
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={contest.revealStep === 0} onClick={() => step(contest.revealStep - 1)}>← Précédente</button>
            <button type="button" className={btn} disabled={contest.revealStep >= steps.length - 1} onClick={() => step(contest.revealStep + 1)}>Suivante →</button>
          </div>
        </div>
      )}
      <a href={`/admin/concours/${contest.id}/scene`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[color:var(--accent-ink)] underline">
        Ouvrir la scène
      </a>

      <p className="text-[14px] text-[color:var(--text-body)]">
        {complete}/{guests.filter((g) => g.rankable > 0).length} invités ont un classement complet
      </p>

      <ContestQr secret={contest.secret} />

      <div>
        <button type="button" onClick={() => setShowLive(!showLive)} className="text-[13px] text-[color:var(--text-muted)] underline">
          {showLive ? 'Masquer le classement en direct' : 'Afficher le classement en direct'}
        </button>
        {showLive && (
          <ol className="mt-2 flex flex-col gap-1 text-[13px] text-[color:var(--text-body)]">
            {rows.map((r) => (
              <li key={r.plateId}>
                {r.position ?? '—'}. Assiette {r.number} — {r.score ?? '—'}/100 ({r.votes} voix) {r.authors.join(' & ')}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
```

```tsx
// src/components/admin/contest/ContestControl.tsx
'use client'

import { usePolling } from '@/components/contest/usePolling'
import type { AdminView } from '@/lib/contest-state'
import { GuestPanel } from './GuestPanel'
import { PilotPanel } from './PilotPanel'
import { PlatePanel } from './PlatePanel'

// Écran de pilotage (spec §9), pensé laptop : trois colonnes. Le polling montre
// les votes arriver ; chaque action relit l'état tout de suite après.
export function ContestControl({ initial }: { initial: AdminView }) {
  const { data: view, refresh } = usePolling<AdminView>(`/api/admin/concours/${initial.contest.id}/etat`, initial)
  const done = () => void refresh()
  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <a href="/admin/concours" className="text-[13px] text-[color:var(--text-muted)] underline">Concours</a>
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{view.contest.name}</h1>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <GuestPanel contestId={view.contest.id} guests={view.guests} onDone={done} />
        <PlatePanel contestId={view.contest.id} phase={view.contest.phase} plates={view.plates} guests={view.guests} onDone={done} />
        <PilotPanel view={view} onDone={done} />
      </div>
    </main>
  )
}
```

```tsx
// src/app/admin/concours/[id]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ContestControl } from '@/components/admin/contest/ContestControl'
import { LoginForm } from '@/components/admin/LoginForm'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { loadAdminView } from '@/lib/contest-views'

export const metadata = { title: 'Pilotage — Concours', robots: { index: false, follow: false } }

export default function ContestControlPage({ params }: PageProps<'/admin/concours/[id]'>) {
  return (
    <Suspense fallback={<main className="p-6">Chargement…</main>}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({ params }: { params: PageProps<'/admin/concours/[id]'>['params'] }) {
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  const id = Number((await params).id)
  const view = Number.isInteger(id) ? await loadAdminView(id) : null
  if (!view) notFound()
  return <ContestControl initial={view} />
}
```

- [ ] **Step 7: Write the scene**

```tsx
// src/components/admin/contest/Scene.tsx
'use client'

import { useEffect } from 'react'
import { setRevealStepAction } from '@/app/actions/contest-admin'
import { usePolling } from '@/components/contest/usePolling'
import type { AdminView, ResultRow } from '@/lib/contest-state'

// Scène de révélation (spec §10) — version fonctionnelle et sobre ; le design
// (et le traitement bilingue) viendra en PR 2. L'étape vit en base : recharger
// la page ou piloter depuis un autre écran reprend exactement au même point.
export function Scene({ initial }: { initial: AdminView }) {
  const { data: view, refresh } = usePolling<AdminView>(`/api/admin/concours/${initial.contest.id}/etat`, initial, 1500)
  const { contest, rows, steps } = view

  useEffect(() => {
    const go = async (s: number) => {
      await setRevealStepAction(contest.id, s)
      await refresh()
    }
    const onKey = (e: KeyboardEvent) => {
      if (contest.phase !== 'reveal') return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        void go(contest.revealStep + 1)
      } else if (e.key === 'ArrowLeft') void go(contest.revealStep - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contest.id, contest.phase, contest.revealStep, refresh])

  const shell = 'flex min-h-dvh flex-col items-center justify-center gap-8 bg-[color:var(--bg)] p-12 text-center'

  if (contest.phase !== 'reveal') {
    return (
      <main className={shell}>
        <h1 className="font-display text-[56px] text-[color:var(--text-strong)]">{contest.name}</h1>
        <p className="text-[24px] text-[color:var(--text-muted)]">En attente de la révélation…</p>
      </main>
    )
  }

  const step = steps[Math.min(contest.revealStep, steps.length - 1)]
  const byId = new Map(rows.map((r) => [r.plateId, r]))

  if (step.kind === 'title') {
    const voters = new Set(view.guests.filter((g) => g.ranked >= 2).map((g) => g.id)).size
    return (
      <main className={shell}>
        <h1 className="font-display text-[80px] leading-none text-[color:var(--text-strong)]">Le verdict</h1>
        <p className="text-[28px] text-[color:var(--text-body)]">{voters} bulletins · {rows.length} assiettes</p>
      </main>
    )
  }

  if (step.kind === 'final') {
    return (
      <main className="flex min-h-dvh flex-col gap-6 bg-[color:var(--bg)] p-12">
        <h1 className="font-display text-[48px] text-[color:var(--text-strong)]">Classement final</h1>
        <ol className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {rows.map((r) => (
            <li key={r.plateId} className="flex items-baseline gap-4 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-4 text-[24px]">
              <span className="font-display w-14 text-[color:var(--accent-ink)]">{r.position ?? '—'}</span>
              <span className="flex-1 text-[color:var(--text-strong)]">Assiette {r.number} — {r.authors.join(' & ') || '?'}</span>
              <span className="text-[color:var(--text-muted)]">{r.score ?? '—'}</span>
            </li>
          ))}
        </ol>
      </main>
    )
  }

  const shown = step.plateIds.map((id) => byId.get(id)).filter((r): r is ResultRow => !!r)
  // Écart avec le rang suivant : « +12 pts devant le 2e » (spec §10).
  const nextRow = rows.find((r) => r.position !== null && r.position > step.position)
  const gap = shown[0]?.score !== null && nextRow?.score != null ? shown[0].score! - nextRow.score : null

  return (
    <main className={shell}>
      <p className={`font-display ${step.podium ? 'text-[120px]' : 'text-[80px]'} leading-none text-[color:var(--accent-ink)]`}>
        {step.position === 1 ? '1er' : `${step.position}e`}
      </p>
      <div className="flex flex-wrap justify-center gap-10">
        {shown.map((r) => (
          <div key={r.plateId} className="flex flex-col items-center gap-2">
            <p className="font-display text-[56px] text-[color:var(--text-strong)]">Assiette {r.number}</p>
            {r.label && <p className="text-[24px] text-[color:var(--text-muted)]">{r.label}</p>}
            <p className="text-[64px] font-medium text-[color:var(--text-strong)]">{r.score}</p>
            <p className="text-[22px] text-[color:var(--text-muted)]">rang moyen {r.avgRank?.toFixed(1)}</p>
            {step.showAuthors && <p className="font-display text-[48px] text-[color:var(--accent-blue)]">{r.authors.join(' & ') || '?'}</p>}
          </div>
        ))}
      </div>
      {step.podium && gap !== null && gap > 0 && (
        <p className="text-[24px] text-[color:var(--text-body)]">+{gap} pts devant le suivant</p>
      )}
    </main>
  )
}
```

```tsx
// src/app/admin/concours/[id]/scene/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LoginForm } from '@/components/admin/LoginForm'
import { Scene } from '@/components/admin/contest/Scene'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { loadAdminView } from '@/lib/contest-views'

export const metadata = { title: 'Scène — Concours', robots: { index: false, follow: false } }

export default function ScenePage({ params }: PageProps<'/admin/concours/[id]/scene'>) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[color:var(--bg)]" />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({ params }: { params: PageProps<'/admin/concours/[id]/scene'>['params'] }) {
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  const id = Number((await params).id)
  const view = Number.isInteger(id) ? await loadAdminView(id) : null
  if (!view) notFound()
  return <Scene initial={view} />
}
```

- [ ] **Step 8: Run tests, typecheck, lint**

Run: `npx next typegen && npx vitest run src/components/admin && npx tsc --noEmit && npm run lint`
Expected: PASS, aucune erreur. (Le test de scène « +20 » : Assiette 1 = 80, suivante = 60.)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/app/admin/concours src/components/admin/contest src/components/admin/AdminHeader.tsx src/components/admin/__tests__/admin-header.test.tsx
git commit -m "feat(concours): admin — liste, pilotage en direct, QR code et scène de révélation"
```

---

### Task 12: Vérification de bout en bout et PR

**Files:** aucun nouveau fichier de production. Script de vérification dans le scratchpad de session uniquement.

- [ ] **Step 1: Suite complète**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert. Coller le résumé Vitest dans le rapport.

- [ ] **Step 2: Migration — DEMANDER À LÉO AVANT**

La base de dev est la base de prod (cf. mémoire « Migrations avant build »). La migration est purement additive (5 `CREATE TABLE IF NOT EXISTS` + 1 index), mais c'est une écriture sur la vraie base : obtenir l'accord explicite de Léo, puis :

Run: `npm run db:migrate`
Expected: `migration ok`.

- [ ] **Step 3: Parcours complet en local (Playwright MCP ou script `playwright-core`)**

Avec `npm run dev` lancé :
1. `/admin/concours` (n'importe quel mot de passe en dev) → créer « Test E2E ».
2. Ajouter invités Alice, Bob, Chloé ; assiettes : n°1 auteur Alice, n°2 auteur Bob, n°3 sans auteur.
3. Deux contextes navigateur « téléphone » (viewport 390×844) sur l'URL du QR : choisir langue FR puis Alice ; EN puis Bob. Vérifier qu'Alice est grisée chez Bob.
4. Admin : passer en « Votes ouverts ». Alice classe 3 puis 2 ; Bob classe 1 puis 3. Vérifier chez Alice que l'assiette 1 n'apparaît pas.
5. Admin : ajouter une assiette n°4 → elle apparaît dans « À goûter » chez les deux en ≤ 3 s.
6. Admin : « Libérer » Bob → son téléphone revient à « Who are you? » avec le message.
7. Admin : fermer les votes, passer en révélation. Scène : avancer au clavier jusqu'à l'écran final ; vérifier que les téléphones affichent « Les yeux sur l'écran ! » jusqu'au dernier appui, puis le récapitulatif.
8. `curl -sI http://localhost:3000/concours/<secret>` → contient `x-robots-tag: noindex, nofollow`. `curl -s http://localhost:3000/robots.txt` → contient `Disallow: /concours/`.
9. Supprimer « Test E2E » ; l'URL invité répond 404.

Captures d'écran des étapes 3, 4, 7 (téléphone + scène) jointes au rapport.

- [ ] **Step 4: Vérifier la branche avant la PR**

Run: `git log --oneline main..HEAD`
Expected: uniquement les commits de cette feature (cf. mémoire « Sessions parallèles et git » : des commits d'une autre session peuvent atterrir sur la branche).

- [ ] **Step 5: PR — DEMANDER À LÉO AVANT DE POUSSER**

Après accord : `git push -u origin feature/concours-cookies` puis `gh pr create` vers `main`, titre « Concours de cookies à l'aveugle (PR 1 — le cœur) », corps : résumé, captures, rappel que la migration est déjà appliquée, et liste de la PR 2 (design de la scène, QR habillé, polish).
