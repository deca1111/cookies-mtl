# Concours de cookies — PR 2 (le spectacle) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habiller le concours (pilotage admin retouché, couleurs de phase, QR exportable, scène bilingue, écrans invités) et permettre à un invité de changer de nom.

**Architecture:** Retouches ciblées des composants existants de `src/components/admin/contest/` et `src/components/contest/`. Trois briques nouvelles et isolées : une route `ImageResponse` pour les PNG du QR, une action serveur `releaseSelfAction`, et des helpers purs (`podium`, `ordinal`, couleurs de phase) partagés entre scène et téléphones.

**Tech Stack:** Next.js 16.3 (App Router, server actions, `next/og`), React 19, Tailwind 4 (valeurs arbitraires `[color:var(--x)]`), Neon (`@neondatabase/serverless`), Vitest + Testing Library (jsdom), lib `qrcode`, Playwright (MCP) pour la vérification finale.

**Spec :** `docs/superpowers/specs/2026-09-25-concours-cookies-pr2-design.md`

## Global Constraints

- Lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire du code Next (AGENTS.md). Pour `ImageResponse` : `01-app/03-api-reference/04-functions/image-response.md` (flexbox seulement, pas de `grid` ; polices `ttf`/`otf`/`woff` ; 500 Ko max).
- Admin en français ; parcours invité et scène FR + EN.
- Textes UI : apostrophes typographiques `’` (U+2019), jamais `'` entre deux lettres (test existant dans `contest-i18n.test.ts`). Sous-agents : modèle sonnet, pas haiku (perd les `’`).
- Icônes : SVG en trait dans `src/components/icons.tsx`, jamais d'emoji ni de caractère décoratif.
- Couleurs de phase (clair / sombre) : preparation `#7d6d5b` / `#a49081` ; voting `#5d7e48` / `#9dbb86` ; closed `#9a3b2a` / `#e5907a` ; reveal `#4560a9` / `#7f98e0`.
- Étiquettes d'assiettes : « N° X » sur fond crème `#fffdf9`, **aucune icône cookie**.
- Pas de mention « Les yeux sur l’écran » : remplacée par « Votes clos » / « Révélation en cours ».
- Aucune modification de schéma. `npm run build` touche la vraie base : ne pas le lancer sans raison ; `npx tsc --noEmit` + `npm test` + `npm run lint` suffisent en cours de route (si tsc refuse une route neuve : `npx next typegen`).
- Commits fréquents, messages en français au format `feat(concours): …` / `fix(concours): …` / `test(concours): …`. Ne jamais `git push` sans l'accord de Léo.
- Tests : `afterEach(cleanup)` explicite dans chaque suite de composants (pas de `globals: true`).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/app/globals.css` (mod) | jetons `--phase-*` et `--phase-ink` clair/sombre |
| `src/components/admin/contest/phase-style.ts` (new) | `phaseColorVar(phase)` → `var(--phase-…)` |
| `src/components/admin/contest/ContestHeader.tsx` (new) | retour « Tous les concours » + nom renommable |
| `src/components/admin/contest/PhaseTimeline.tsx` (new) | frise + boutons de phase + avancement |
| `src/components/admin/contest/ContestControl.tsx` (mod) | assemble : `--phase`, liseré, en-tête, frise, colonnes |
| `src/components/admin/contest/GuestPanel.tsx` (mod) | en-tête de colonne, statuts en pastilles |
| `src/components/admin/contest/PlatePanel.tsx` (mod) | cartes d'assiettes, édition dans la carte |
| `src/components/admin/contest/PilotPanel.tsx` (mod) | blocs Scène / Accès invités / Classement en direct |
| `src/components/admin/contest/AccessPanel.tsx` (new, remplace `ContestQr.tsx`) | aperçu PNG, export, partage, URL copiable |
| `src/lib/contest-qr-image.tsx` (new) | JSX des images carte / QR seul pour `ImageResponse` |
| `src/lib/contest-qr-name.ts` (new) | `qrFileName()` pur (séparé pour être testable sans `next/og`) |
| `src/app/api/admin/concours/[id]/qr/route.ts` (new) | route PNG protégée |
| `src/fonts/comfortaa-700.woff` (new) | police de la consigne |
| `src/lib/contest-db.ts` (mod) | `renameContest`, `releaseSelf` |
| `src/app/actions/contest-admin.ts` (mod) | `renameContestAction` |
| `src/app/actions/contest-guest.ts` (mod) | `releaseSelfAction` |
| `src/lib/contest-i18n.ts` (mod) | nouvelles clés, `ordinal()` |
| `src/lib/contest-podium.ts` (new) | `podium(rows)` pur |
| `src/components/contest/PlateTag.tsx` (new) | étiquette crème « N° X » (tailles sm / md / lg) |
| `src/components/contest/Podium.tsx` (new) | pyramide des 3 premiers (scène + récap invité) |
| `src/components/contest/ChangeNameSheet.tsx` (new) | feuille « Tu n’es pas X ? » |
| `src/components/contest/ContestGuestApp.tsx` (mod) | en-tête, pastille prénom, textes clos/révélation |
| `src/components/contest/RankingBoard.tsx`, `NamePicker.tsx`, `LanguagePicker.tsx`, `GuestResults.tsx` (mod) | polish visuel |
| `src/components/admin/contest/Scene.tsx` (mod) | rendu de la scène |

---

### Task 1 : Jetons de couleur de phase

**Files:**
- Modify: `src/app/globals.css` (bloc `:root` clair vers la ligne 46, bloc sombre vers la ligne 98)
- Create: `src/components/admin/contest/phase-style.ts`
- Modify: `src/components/admin/contest/ContestList.tsx:61-63`
- Test: `src/components/admin/contest/__tests__/phase-style.test.ts`

**Interfaces:**
- Produces: `phaseColorVar(phase: Phase): string` (ex. `'var(--phase-voting)'`) ; variables CSS `--phase-preparation`, `--phase-voting`, `--phase-closed`, `--phase-reveal`, `--phase-ink` (texte sur fond de phase plein).

- [ ] **Step 1 : test qui échoue**

```ts
// src/components/admin/contest/__tests__/phase-style.test.ts
import { expect, test } from 'vitest'
import { PHASES } from '@/lib/contest-rules'
import { phaseColorVar } from '../phase-style'

test('chaque phase a sa variable CSS', () => {
  expect(PHASES.map(phaseColorVar)).toEqual([
    'var(--phase-preparation)', 'var(--phase-voting)', 'var(--phase-closed)', 'var(--phase-reveal)',
  ])
})
```

- [ ] **Step 2 :** `npx vitest run src/components/admin/contest/__tests__/phase-style.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémentation**

```ts
// src/components/admin/contest/phase-style.ts
import type { Phase } from '@/lib/contest-rules'

// Code « feu » (spec PR 2 §2) : une couleur par phase, définie dans globals.css
// pour suivre le thème clair/sombre. On passe par une variable plutôt qu'une
// valeur en dur pour que le changement de thème s'applique sans rerendu.
export function phaseColorVar(phase: Phase): string {
  return `var(--phase-${phase})`
}
```

Dans `globals.css`, bloc clair (après `--accent-gold-ink`) :

```css
  /* Couleurs de phase du concours — code « feu » (PR 2) */
  --phase-preparation: #7d6d5b;
  --phase-voting: #5d7e48;
  --phase-closed: #9a3b2a;
  --phase-reveal: #4560a9;
  --phase-ink: #fffdf9; /* texte sur un bouton plein de couleur de phase */
```

Bloc sombre (après `--danger`) :

```css
  --phase-preparation: #a49081;
  --phase-voting: #9dbb86;
  --phase-closed: #e5907a;
  --phase-reveal: #7f98e0; /* bleu logo éclairci pour le fond chocolat (choix Léo) */
  --phase-ink: #241a13;
```

Vérifier s'il existe un 3e bloc (ex. `[data-theme='dark']` doublé d'un `@media (prefers-color-scheme)`) : `grep -n "surface-2" src/app/globals.css` ; ajouter les mêmes 5 lignes sombres dans chaque bloc sombre.

Dans `ContestList.tsx`, remplacer le `<span>` de la ligne 61 :

```tsx
              <span className="text-[13px] text-[color:var(--text-muted)]">
                <span className="font-medium" style={{ color: phaseColorVar(c.phase) }}>{PHASE_LABEL[c.phase]}</span>
                {' '}· {c.guestCount} invités · {new Date(c.createdAt).toLocaleDateString('fr-CA')}
              </span>
```

avec `import { phaseColorVar } from './phase-style'`.

- [ ] **Step 4 :** `npx vitest run src/components/admin/contest` → PASS (y compris `contest-list.test.tsx` existant ; si un test cherchait le texte exact `Préparation · 3 invités`, l'adapter avec un matcher de fonction sur `textContent`).

- [ ] **Step 5 : commit** — `git add -A src/app/globals.css src/components/admin/contest && git commit -m "feat(concours): couleurs de phase (code feu)"`

---

### Task 2 : Renommer le concours + en-tête du pilotage

**Files:**
- Modify: `src/lib/contest-db.ts` (après `deleteContest`, ligne ~44)
- Modify: `src/app/actions/contest-admin.ts` (après `deleteContestAction`)
- Create: `src/components/admin/contest/ContestHeader.tsx`
- Modify: `src/components/admin/contest/ContestControl.tsx`
- Test: `src/app/actions/__tests__/contest-admin.test.ts` (ajouts), `src/components/admin/contest/__tests__/contest-header.test.tsx`

**Interfaces:**
- Produces: `renameContest(id: number, name: string): Promise<boolean>` (true si une ligne mise à jour) ; `renameContestAction(id: number, name: string): Promise<{ ok: true } | { ok: false; error: 'name' | 'not-found' }>` ; `<ContestHeader contestId={number} name={string} onDone={() => void} />`.

- [ ] **Step 1 : tests d'action qui échouent.** Ouvrir `src/app/actions/__tests__/contest-admin.test.ts`, ajouter `renameContest: vi.fn()` à l'objet de mocks de `@/lib/contest-db` en suivant exactement le motif du fichier (objet `db` + `vi.mock` qui délègue), importer `renameContestAction`, puis :

```ts
test('renommer : nom nettoyé puis enregistré', async () => {
  db.renameContest.mockResolvedValue(true)
  expect(await renameContestAction(1, '  Anniv   Léo ')).toEqual({ ok: true })
  expect(db.renameContest).toHaveBeenCalledWith(1, 'Anniv Léo')
})

test('renommer : nom vide ou trop long refusé, rien écrit', async () => {
  expect(await renameContestAction(1, '   ')).toEqual({ ok: false, error: 'name' })
  expect(await renameContestAction(1, 'x'.repeat(41))).toEqual({ ok: false, error: 'name' })
  expect(db.renameContest).not.toHaveBeenCalled()
})

test('renommer : concours inconnu', async () => {
  db.renameContest.mockResolvedValue(false)
  expect(await renameContestAction(9, 'Anniv')).toEqual({ ok: false, error: 'not-found' })
})
```

- [ ] **Step 2 :** `npx vitest run src/app/actions/__tests__/contest-admin.test.ts` → FAIL.

- [ ] **Step 3 : implémentation**

```ts
// contest-db.ts
export async function renameContest(id: number, name: string): Promise<boolean> {
  const rows = (await getSql()`
    UPDATE contests SET name = ${name}, updated_at = now() WHERE id = ${id} RETURNING id
  `) as { id: number }[]
  return rows.length === 1
}
```

```ts
// contest-admin.ts (ajouter renameContest à l'import de '@/lib/contest-db')
export async function renameContestAction(id: number, name: string): Promise<{ ok: true } | { ok: false; error: 'name' | 'not-found' }> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  return (await renameContest(id, clean)) ? OK : { ok: false, error: 'not-found' }
}
```

- [ ] **Step 4 :** relancer → PASS.

- [ ] **Step 5 : test composant qui échoue**

```tsx
// src/components/admin/contest/__tests__/contest-header.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const renameContestAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({ renameContestAction: (...a: unknown[]) => renameContestAction(...a) }))

import { ContestHeader } from '../ContestHeader'

afterEach(cleanup)
beforeEach(() => renameContestAction.mockReset().mockResolvedValue({ ok: true }))

test('retour vers la liste des concours', () => {
  render(<ContestHeader contestId={1} name="Anniv" onDone={vi.fn()} />)
  expect(screen.getByRole('link', { name: /Tous les concours/ }).getAttribute('href')).toBe('/admin/concours')
})

test('crayon → champ, Entrée enregistre puis relit l’état', async () => {
  const onDone = vi.fn()
  render(<ContestHeader contestId={1} name="Anniv" onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: 'Renommer le concours' }))
  const input = screen.getByRole('textbox', { name: 'Nom du concours' })
  fireEvent.change(input, { target: { value: 'Anniv Léo' } })
  fireEvent.submit(input)
  await waitFor(() => expect(renameContestAction).toHaveBeenCalledWith(1, 'Anniv Léo'))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('Échap annule sans appel', () => {
  render(<ContestHeader contestId={1} name="Anniv" onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Renommer le concours' }))
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(renameContestAction).not.toHaveBeenCalled()
})

test('nom refusé : message, le champ reste ouvert', async () => {
  renameContestAction.mockResolvedValue({ ok: false, error: 'name' })
  render(<ContestHeader contestId={1} name="Anniv" onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Renommer le concours' }))
  fireEvent.submit(screen.getByRole('textbox'))
  expect(await screen.findByText('Nom vide ou trop long (40 max).')).toBeTruthy()
  expect(screen.getByRole('textbox')).toBeTruthy()
})
```

- [ ] **Step 6 :** lancer → FAIL.

- [ ] **Step 7 : implémentation.** Ajouter `IconPencil` et `IconChevronLeft` à `src/components/icons.tsx` (même motif que les autres) :

```tsx
export function IconPencil({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function IconChevronLeft({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function IconChevronRight({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
```

```tsx
// src/components/admin/contest/ContestHeader.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { renameContestAction } from '@/app/actions/contest-admin'
import { IconChevronLeft, IconPencil } from '@/components/icons'
import { runAction, UNEXPECTED_ERROR } from './runAction'

const ERR: Record<string, string> = {
  name: 'Nom vide ou trop long (40 max).',
  'not-found': 'Concours introuvable — il a peut-être été supprimé.',
  unexpected: UNEXPECTED_ERROR,
}

// En-tête du pilotage (spec PR 2 §2) : retour propre vers la liste et nom
// renommable sur place. Échap ou perte de focus abandonnent la saisie.
export function ContestHeader({ contestId, name, onDone }: { contestId: number; name: string; onDone: () => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (draft === null || saving) return
    setSaving(true)
    const res = await runAction(renameContestAction(contestId, draft))
    setSaving(false)
    if (res.ok) {
      setDraft(null)
      setError(null)
    } else setError(ERR[res.error] ?? 'Erreur.')
    onDone()
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/concours"
          className="flex items-center gap-1 rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[13px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)]"
        >
          <IconChevronLeft size={14} />
          Tous les concours
        </Link>
        {draft === null ? (
          <>
            <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{name}</h1>
            <button
              type="button"
              aria-label="Renommer le concours"
              onClick={() => { setDraft(name); setError(null) }}
              className="rounded-[var(--radius-field)] border border-[color:var(--border)] p-1.5 text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]"
            >
              <IconPencil size={14} />
            </button>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void save() }}>
            <input
              autoFocus
              aria-label="Nom du concours"
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(null); setError(null) } }}
              onBlur={() => { if (!saving && !error) setDraft(null) }}
              className="font-display rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-2 py-1 text-[22px] text-[color:var(--text-strong)]"
            />
          </form>
        )}
      </div>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}
    </div>
  )
}
```

Dans `ContestControl.tsx`, remplacer le bloc `<div className="flex items-center gap-3">…</div>` (lien + h1) par `<ContestHeader contestId={view.contest.id} name={view.contest.name} onDone={done} />` et retirer l'import `Link` devenu inutile.

- [ ] **Step 8 :** `npx vitest run src/components/admin/contest src/app/actions` → PASS ; `npx tsc --noEmit` → 0 erreur.

- [ ] **Step 9 : commit** — `git commit -am "feat(concours): renommer le concours et retour propre vers la liste"` (après `git add` des nouveaux fichiers).

---

### Task 3 : Frise des phases et habillage de la page

**Files:**
- Create: `src/components/admin/contest/PhaseTimeline.tsx`
- Modify: `src/components/admin/contest/ContestControl.tsx`, `src/components/admin/contest/PilotPanel.tsx` (retirer le bloc « Phase » et `changePhase`)
- Test: `src/components/admin/contest/__tests__/phase-timeline.test.tsx` ; adapter `pilot-panel.test.tsx` (déplacer les deux tests de phase)

**Interfaces:**
- Consumes: `phaseColorVar` (Task 1), `shiftPhaseAction(contestId, from, dir)`, `shiftPhase`, `PHASES`, `PHASE_LABEL`.
- Produces: `<PhaseTimeline contestId={number} phase={Phase} complete={number} rankableGuests={number} onDone={() => void} />`. `ContestControl` pose `style={{ '--phase': phaseColorVar(phase) }}` sur `<main>` : tous les enfants peuvent utiliser `var(--phase)`.

- [ ] **Step 1 : test qui échoue** — déplacer depuis `pilot-panel.test.tsx` les tests « changement de phase : le bouton se désactive… » et « phase périmée… » dans le nouveau fichier en changeant le rendu, et ajouter :

```tsx
// src/components/admin/contest/__tests__/phase-timeline.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const shiftPhaseAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({ shiftPhaseAction: (...a: unknown[]) => shiftPhaseAction(...a) }))

import { PhaseTimeline } from '../PhaseTimeline'

afterEach(cleanup)
beforeEach(() => shiftPhaseAction.mockReset().mockResolvedValue({ ok: true }))

const renderAt = (phase: 'preparation' | 'voting' | 'closed' | 'reveal') =>
  render(<PhaseTimeline contestId={1} phase={phase} complete={3} rankableGuests={6} onDone={vi.fn()} />)

test('les 4 étapes, la courante marquée', () => {
  renderAt('voting')
  for (const l of ['Préparation', 'Votes ouverts', 'Votes clos', 'Révélation']) expect(screen.getAllByText(l).length).toBeGreaterThan(0)
  expect(screen.getByText('Votes ouverts', { selector: '[aria-current="step"]' })).toBeTruthy()
})

test('boutons précédent / suivant autour de la frise, absents aux extrémités', () => {
  renderAt('preparation')
  expect(screen.queryByRole('button', { name: /‹/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Votes ouverts ›' })).toBeTruthy()
  cleanup()
  renderAt('reveal')
  expect(screen.getByRole('button', { name: '‹ Votes clos' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /›/ })).toBeNull()
})

test('avancement des bulletins sous la frise', () => {
  renderAt('voting')
  expect(screen.getByText('3/6 invités ont un classement complet')).toBeTruthy()
})

test('changement de phase : un seul appel malgré le double clic', async () => {
  let resolve: (v: { ok: true }) => void = () => {}
  shiftPhaseAction.mockImplementation(() => new Promise((r) => { resolve = r }))
  renderAt('preparation')
  const btn = screen.getByRole('button', { name: 'Votes ouverts ›' })
  fireEvent.click(btn)
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(true))
  fireEvent.click(btn)
  resolve({ ok: true })
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(false))
  expect(shiftPhaseAction).toHaveBeenCalledTimes(1)
  expect(shiftPhaseAction).toHaveBeenCalledWith(1, 'preparation', 1)
})

test('phase périmée : message dédié', async () => {
  shiftPhaseAction.mockResolvedValue({ ok: false, error: 'stale' })
  renderAt('preparation')
  fireEvent.click(screen.getByRole('button', { name: 'Votes ouverts ›' }))
  expect(await screen.findByText('La phase a déjà changé.')).toBeTruthy()
})
```

- [ ] **Step 2 :** lancer → FAIL.

- [ ] **Step 3 : implémentation**

```tsx
// src/components/admin/contest/PhaseTimeline.tsx
'use client'

import { Fragment, useState } from 'react'
import { shiftPhaseAction } from '@/app/actions/contest-admin'
import { PHASES, shiftPhase, type Phase } from '@/lib/contest-rules'
import { PHASE_LABEL } from './phase-label'
import { runAction, UNEXPECTED_ERROR } from './runAction'

const ERR: Record<string, string> = {
  'not-found': 'Concours introuvable — il a peut-être été supprimé.',
  stale: 'La phase a déjà changé.',
  unexpected: UNEXPECTED_ERROR,
}

// Frise des 4 phases (spec PR 2 §2), boutons collés aux étapes. `busy` : un
// double clic ferait sauter une phase (actions serveur sérialisées, finding #1
// de la PR 1).
export function PhaseTimeline({ contestId, phase, complete, rankableGuests, onDone }: {
  contestId: number; phase: Phase; complete: number; rankableGuests: number; onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idx = PHASES.indexOf(phase)
  const prev = shiftPhase(phase, -1)
  const next = shiftPhase(phase, 1)

  const change = async (dir: 1 | -1) => {
    if (busy) return
    setBusy(true)
    const res = await runAction(shiftPhaseAction(contestId, phase, dir))
    setError(res.ok ? null : (ERR[res.error] ?? 'Erreur.'))
    setBusy(false)
    onDone()
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {prev !== phase && (
          <button type="button" disabled={busy} onClick={() => change(-1)}
            className="rounded-[var(--radius-field)] border border-[color:var(--border-strong)] px-3 py-1.5 text-[13px] text-[color:var(--text-body)] disabled:opacity-40">
            ‹ {PHASE_LABEL[prev]}
          </button>
        )}
        <ol className="flex min-w-[320px] flex-1 items-center">
          {PHASES.map((p, i) => (
            <Fragment key={p}>
              {i > 0 && <li aria-hidden="true" className="mx-2 h-0.5 flex-1 bg-[color:var(--border)]" />}
              <li className={`flex items-center gap-2 text-[13px] ${i < idx ? 'opacity-60' : ''}`}>
                <span
                  className="h-3 w-3 flex-none rounded-full border-2"
                  style={i === idx
                    ? { background: 'var(--phase)', borderColor: 'var(--phase)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--phase) 25%, transparent)' }
                    : { borderColor: 'var(--border-strong)', background: i < idx ? 'var(--border-strong)' : 'transparent' }}
                />
                <span
                  aria-current={i === idx ? 'step' : undefined}
                  className={i === idx ? 'font-bold text-[color:var(--text-strong)]' : 'text-[color:var(--text-muted)]'}
                >
                  {PHASE_LABEL[p]}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
        {next !== phase && (
          <button type="button" disabled={busy} onClick={() => change(1)}
            className="rounded-[var(--radius-field)] px-3 py-1.5 text-[13px] font-bold disabled:opacity-40"
            style={{ background: 'var(--phase)', color: 'var(--phase-ink)' }}>
            {PHASE_LABEL[next]} ›
          </button>
        )}
      </div>
      <p className="text-[13px] text-[color:var(--text-muted)]">{complete}/{rankableGuests} invités ont un classement complet</p>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}
    </section>
  )
}
```

`ContestControl.tsx` : le `<main>` devient

```tsx
    <main
      className="flex min-h-dvh flex-col gap-6 border-t-[3px] p-6"
      style={{ '--phase': phaseColorVar(view.contest.phase), borderTopColor: 'var(--phase)' } as React.CSSProperties}
    >
```

et, sous `<ContestHeader …/>`, ajouter
`<PhaseTimeline contestId={view.contest.id} phase={view.contest.phase} complete={view.complete} rankableGuests={view.guests.filter((g) => g.rankable > 0).length} onDone={done} />`
(imports `phaseColorVar`, `PhaseTimeline`, `type CSSProperties` depuis react au lieu de `React.CSSProperties` si le fichier n'importe pas `React`).

`PilotPanel.tsx` : supprimer `changePhase`, `next`, `prev`, le bloc `<div className="rounded-… p-3">` « Phase » et le paragraphe `{complete}/…` (désormais dans la frise). Garder `busy` pour les étapes de révélation.

- [ ] **Step 4 :** `npx vitest run src/components/admin/contest` → PASS (retirer de `pilot-panel.test.tsx` les deux tests déplacés).

- [ ] **Step 5 : commit** — `feat(concours): frise des phases avec boutons collés aux étapes`

---

### Task 4 : Colonnes Invités et Assiettes, cartes éditables sur place

**Files:**
- Modify: `src/components/admin/contest/GuestPanel.tsx`, `src/components/admin/contest/PlatePanel.tsx`
- Test: `src/components/admin/contest/__tests__/plate-panel.test.tsx` (adapter + ajouts), `guest-panel.test.tsx` (adapter si des textes changent)

**Interfaces:**
- Consumes: `var(--phase)` posé par `ContestControl` (Task 3).
- Produces: rien de nouveau pour les autres tâches (signatures de `GuestPanel` et `PlatePanel` inchangées).

- [ ] **Step 1 : lire** `plate-panel.test.tsx` en entier : repérer les sélecteurs qui dépendent de l'ancien formulaire en haut de colonne (`placeholder="Label (facultatif)"`, bouton « Ajouter », etc.).

- [ ] **Step 2 : tests qui échouent** (ajouter à `plate-panel.test.tsx`, en réutilisant son `renderPanel`/données s'il en a, sinon ce qui suit) :

```tsx
test('carte : numéro et auteurs d’abord, note en second', () => {
  render(<PlatePanel contestId={1} phase="voting" onDone={vi.fn()}
    guests={[{ id: 5, name: 'Camille', claimed: false, ranked: 0, rankable: 0 }, { id: 6, name: 'Hugo', claimed: false, ranked: 0, rankable: 0 }]}
    plates={[{ id: 10, number: 1, label: 'pécan caramel', authorIds: [5, 6] }]} />)
  const card = screen.getByRole('button', { name: /Modifier l’assiette 1/ })
  expect(card.textContent).toMatch(/1.*Camille & Hugo.*pécan caramel/)
})

test('clic sur la carte : édition dans la carte, une seule à la fois', () => {
  render(<PlatePanel contestId={1} phase="voting" onDone={vi.fn()} guests={[]}
    plates={[{ id: 10, number: 1, label: null, authorIds: [] }, { id: 11, number: 2, label: null, authorIds: [] }]} />)
  fireEvent.click(screen.getByRole('button', { name: /Modifier l’assiette 1/ }))
  expect(screen.getByPlaceholderText('Note facultative…')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Modifier l’assiette 2/ }))
  expect(screen.getAllByPlaceholderText('Note facultative…')).toHaveLength(1)
  expect(screen.getByRole('button', { name: /Modifier l’assiette 1/ })).toBeTruthy()
})

test('« + Ajouter » : carte provisoire en bas de liste', () => {
  render(<PlatePanel contestId={1} phase="preparation" onDone={vi.fn()} guests={[]}
    plates={[{ id: 10, number: 1, label: null, authorIds: [] }]} />)
  fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  const items = screen.getAllByRole('listitem')
  expect(items[items.length - 1].querySelector('input[placeholder="Note facultative…"]')).not.toBeNull()
})
```

- [ ] **Step 3 :** lancer → FAIL.

- [ ] **Step 4 : implémentation `PlatePanel`.** Garder toute la logique (`draft`, `saving`, `save`, `toggleAuthor`, `numberLocked`, `useConfirmDelete`, `ERR`, mélange). Changer le rendu :
  - En-tête de colonne :
    ```tsx
    <div className="flex items-center gap-2 border-b-2 border-[color:var(--border)] pb-2">
      <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">Assiettes</h2>
      <span className="text-[13px] text-[color:var(--text-muted)]">{plates.length}</span>
      <span className="flex-1" />
      {/* bouton « Mélanger les numéros » inchangé */}
      <button type="button" onClick={() => setDraft({ number: '', label: '', authorIds: [] })} className="rounded-full bg-[color:var(--btn-bg)] px-3 py-1.5 text-[13px] text-[color:var(--btn-text)]">+ Ajouter</button>
    </div>
    ```
  - Extraire le formulaire actuel dans une fonction locale `editor()` qui rend le même contenu (numéro, pastilles d'auteurs, champ note, Enregistrer / Annuler), avec le placeholder du label renommé `Note facultative…` et la bordure `style={{ borderColor: 'var(--phase)' }}`.
  - Liste : pour chaque assiette, si `draft?.id === p.id` → `<li>{editor()}</li>` ; sinon :
    ```tsx
    <li key={p.id} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <button type="button" aria-label={`Modifier l’assiette ${p.number}`}
        onClick={() => setDraft({ id: p.id, number: String(p.number), label: p.label ?? '', authorIds: p.authorIds })}
        className="flex flex-1 items-start gap-3 text-left">
        <span className="font-display w-8 text-[24px] leading-none" style={{ color: 'var(--phase)' }}>{p.number}</span>
        <span className="flex-1">
          <span className="block text-[15px] font-bold text-[color:var(--text-strong)]">
            {p.authorIds.map((id) => nameOf.get(id)).filter(Boolean).join(' & ') || 'Aucun auteur'}
          </span>
          {p.label && <span className="block text-[12px] text-[color:var(--text-muted)]">{p.label}</span>}
        </span>
      </button>
      {/* bouton Suppr./Confirmer ? inchangé */}
    </li>
    ```
  - Nouvelle assiette : si `draft && draft.id === undefined`, rendre `<li>{editor()}</li>` **après** la dernière carte.
  - Retirer l'ancien bloc `{draft && (…)}` en haut.

- [ ] **Step 5 : `GuestPanel`.** En-tête identique (`border-b-2`, h2 « Invités » + compteur muet). Statut en pastille :
  ```tsx
  <span className={`rounded-full px-2 py-0.5 text-[11px] ${g.claimed
    ? 'bg-[color:var(--accent-wash)] text-[color:var(--accent-ink)]'
    : 'border border-[color:var(--border)] text-[color:var(--text-muted)]'}`}>{status(g)}</span>
  ```
  Le titre passe de `Invités ({guests.length})` à `Invités` + `<span>{guests.length}</span>` : adapter `guest-panel.test.tsx` s'il cherche `Invités (`.

- [ ] **Step 6 :** `npx vitest run src/components/admin/contest` → PASS (adapter les anciens sélecteurs repérés au Step 1 : placeholder `Note facultative…`, bouton `+ Ajouter`, ouverture par `Modifier l’assiette N`).

- [ ] **Step 7 : commit** — `feat(concours): cartes d’assiettes éditables sur place, colonnes séparées`

---

### Task 5 : Route PNG du QR (carte / QR seul)

**Files:**
- Create: `src/fonts/comfortaa-700.woff`
- Create: `src/lib/contest-qr-image.tsx`
- Create: `src/lib/contest-qr-name.ts`
- Create: `src/app/api/admin/concours/[id]/qr/route.ts`
- Test: `src/app/api/concours/__tests__/qr-route.test.ts`

**Interfaces:**
- Consumes: `isAdmin`, `parseContestId`, `getContestById` (`src/lib/contest-db.ts`, retourne `Contest | null`).
- Produces: `GET /api/admin/concours/[id]/qr?format=carte|qr[&download=1]` → `image/png`. Helpers `qrCardImage(opts)` et `qrOnlyImage(opts)` renvoyant `ImageResponse`. Fonction pure `qrFileName(contestName: string, format: 'carte' | 'qr'): string` exportée par `src/lib/contest-qr-name.ts`.

- [ ] **Step 1 : police.** Récupérer la graisse 700 latine de Comfortaa (OFL) sans ajouter de dépendance :
  ```bash
  cd "$TMPDIR" && npm pack @fontsource/comfortaa && tar -xzf fontsource-comfortaa-*.tgz
  cp package/files/comfortaa-latin-700-normal.woff "C:/Users/leova/Documents/Projets/cookies-mtl/src/fonts/comfortaa-700.woff"
  ```
  (`$TMPDIR` = le scratchpad de la session.) Vérifier la taille (< 60 Ko).

- [ ] **Step 2 : tests qui échouent**

```ts
// src/app/api/concours/__tests__/qr-route.test.ts
import { beforeEach, expect, test, vi } from 'vitest'

const isAdmin = vi.fn()
const getContestById = vi.fn()
vi.mock('@/lib/auth', () => ({ isAdmin: () => isAdmin() }))
vi.mock('@/lib/contest-db', () => ({ getContestById: (...a: unknown[]) => getContestById(...a) }))
// Satori/Resvg ne tournent pas sous jsdom : on vérifie ce que la route leur passe.
const qrCardImage = vi.fn(() => new Response('png', { headers: { 'Content-Type': 'image/png' } }))
const qrOnlyImage = vi.fn(() => new Response('png', { headers: { 'Content-Type': 'image/png' } }))
vi.mock('@/lib/contest-qr-image', () => ({
  qrCardImage: (...a: unknown[]) => qrCardImage(...a),
  qrOnlyImage: (...a: unknown[]) => qrOnlyImage(...a),
}))

import { GET } from '../../admin/concours/[id]/qr/route'
import { qrFileName } from '@/lib/contest-qr-name'

const call = (qs: string, id = '1') => GET(new Request(`https://cookies.club/api/admin/concours/${id}/qr${qs}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  isAdmin.mockReset().mockResolvedValue(true)
  getContestById.mockReset().mockResolvedValue({ id: 1, name: 'Anniv’ Léo', secret: 'k3f9', phase: 'voting', revealStep: 0 })
  qrCardImage.mockClear(); qrOnlyImage.mockClear()
})

test('401 sans session', async () => {
  isAdmin.mockResolvedValue(false)
  expect((await call('?format=carte')).status).toBe(401)
})

test('400 format invalide, 404 concours inconnu', async () => {
  expect((await call('?format=bof')).status).toBe(400)
  getContestById.mockResolvedValue(null)
  expect((await call('?format=qr')).status).toBe(404)
})

test('carte : URL construite depuis l’origine de la requête, non indexée, jamais en cache', async () => {
  const res = await call('?format=carte')
  expect(res.status).toBe(200)
  expect(qrCardImage).toHaveBeenCalledWith({ url: 'https://cookies.club/concours/k3f9', name: 'Anniv’ Léo' })
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  expect(res.headers.get('Cache-Control')).toBe('no-store')
  expect(res.headers.get('Content-Disposition')).toBeNull()
})

test('qr seul + download : pièce jointe nommée', async () => {
  const res = await call('?format=qr&download=1')
  expect(qrOnlyImage).toHaveBeenCalledWith({ url: 'https://cookies.club/concours/k3f9' })
  expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="concours-anniv-leo-qr.png"')
})

test('nom de fichier : accents et ponctuation retirés', () => {
  expect(qrFileName('Anniv’ Léo !', 'carte')).toBe('concours-anniv-leo-carte.png')
  expect(qrFileName('***', 'qr')).toBe('concours-qr.png')
})
```

- [ ] **Step 3 :** lancer → FAIL.

- [ ] **Step 4 : implémentation des images.** Lire d'abord `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md`.

```tsx
// src/lib/contest-qr-image.tsx
// Images PNG du QR (spec PR 2 §4), rendues par Satori : flexbox seulement,
// chaque <div> à plusieurs enfants doit déclarer `display: flex`.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'

const CHOCO = '#2c1f16'

async function qrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: CHOCO, light: '#0000' } })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const read = (rel: string) => readFile(join(process.cwd(), rel))

export async function qrCardImage({ url, name }: { url: string; name: string }): Promise<ImageResponse> {
  const [qr, logo, gill, comfortaa] = await Promise.all([
    qrDataUri(url),
    read('public/brand/logo.svg'),
    read('src/fonts/gill-sans-ultra-bold.otf'),
    read('src/fonts/comfortaa-700.woff'),
  ])
  const logoUri = `data:image/svg+xml;base64,${logo.toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'transparent' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, background: '#fffdf9', border: '14px solid #d29a55', borderRadius: 48, margin: 0 }}>
          <img src={logoUri} width={260} height={260} alt="" />
          <div style={{ fontFamily: 'Gill Sans Ultra', fontSize: 76, color: CHOCO, textAlign: 'center', maxWidth: 900 }}>{name}</div>
          <div style={{ display: 'flex', background: '#f6f0e6', borderRadius: 40, padding: 44 }}>
            <img src={qr} width={560} height={560} alt="" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Comfortaa', fontSize: 44 }}>
            <div style={{ color: CHOCO }}>Scanne, goûte, classe.</div>
            <div style={{ color: '#7d6d5b', fontSize: 38, marginTop: 8 }}>Scan, taste, rank.</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1440,
      fonts: [
        { name: 'Gill Sans Ultra', data: gill, weight: 700, style: 'normal' },
        { name: 'Comfortaa', data: comfortaa, weight: 700, style: 'normal' },
      ],
    },
  )
}

export async function qrOnlyImage({ url }: { url: string }): Promise<ImageResponse> {
  const qr = await qrDataUri(url)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffdf9' }}>
        <img src={qr} width={880} height={880} alt="" />
      </div>
    ),
    { width: 1024, height: 1024 },
  )
}
```

(Fond extérieur transparent : les coins arrondis de la carte restent propres à l'impression comme sur un fond de message.)

```ts
// src/lib/contest-qr-name.ts
// Nom du PNG téléchargé : « concours-anniv-leo-carte.png ». Accents retirés,
// tout le reste réduit à des tirets.
export function qrFileName(contestName: string, format: 'carte' | 'qr'): string {
  const slug = contestName.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `concours-${slug ? `${slug}-` : ''}${format}.png`
}
```

- [ ] **Step 5 : route**

```ts
// src/app/api/admin/concours/[id]/qr/route.ts
import { isAdmin } from '@/lib/auth'
import { getContestById } from '@/lib/contest-db'
import { qrCardImage, qrOnlyImage } from '@/lib/contest-qr-image'
import { qrFileName } from '@/lib/contest-qr-name'
import { parseContestId } from '@/lib/contest-rules'

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: HEADERS })
  const { searchParams, origin } = new URL(request.url)
  const format = searchParams.get('format')
  if (format !== 'carte' && format !== 'qr') return Response.json({ error: 'format' }, { status: 400, headers: HEADERS })
  const id = parseContestId((await params).id)
  const contest = id === null ? null : await getContestById(id)
  if (!contest) return Response.json({ error: 'not-found' }, { status: 404, headers: HEADERS })

  // L'origine de la requête : le QR pointe vers le domaine réellement servi
  // (prod, preview, localhost), comme l'ancien QR généré côté client.
  const url = `${origin}/concours/${contest.secret}`
  const image = format === 'carte' ? await qrCardImage({ url, name: contest.name }) : await qrOnlyImage({ url })
  const headers = new Headers(image.headers)
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v)
  if (searchParams.get('download') === '1') headers.set('Content-Disposition', `attachment; filename="${qrFileName(contest.name, format)}"`)
  return new Response(image.body, { status: 200, headers })
}
```

- [ ] **Step 6 :** `npx vitest run src/app/api` → PASS ; `npx tsc --noEmit` (sinon `npx next typegen` puis relancer).

- [ ] **Step 7 : vérification réelle.** `npm run dev` (en arrière-plan), se connecter à `/admin` (n'importe quel mot de passe en dev), ouvrir `http://localhost:3000/api/admin/concours/<id>/qr?format=carte` puis `?format=qr` : l'image s'affiche, le logo et les deux polices sont bons, le QR se scanne avec un téléphone. Contrôler le poids de la réponse (< 500 Ko de bundle : sinon réduire le logo).

- [ ] **Step 8 : commit** — `feat(concours): PNG du QR habillé (carte ou QR seul)`

---

### Task 6 : Colonne de droite en trois blocs (Scène, Accès invités, Classement en direct)

**Files:**
- Create: `src/components/admin/contest/AccessPanel.tsx`
- Delete: `src/components/admin/contest/ContestQr.tsx`
- Modify: `src/components/admin/contest/PilotPanel.tsx`, `src/components/icons.tsx`
- Test: `src/components/admin/contest/__tests__/access-panel.test.tsx`, `pilot-panel.test.tsx` (adapter)

**Interfaces:**
- Consumes: route de la Task 5 ; `IconCopy`, `IconShare`, `IconExternal` existants.
- Produces: `<AccessPanel contestId={number} secret={string} />` ; icônes `IconEye`, `IconEyeOff`, `IconDownload`.

- [ ] **Step 1 : icônes** (dans `icons.tsx`) :

```tsx
export function IconEye({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconEyeOff({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </svg>
  )
}

export function IconDownload({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  )
}
```

- [ ] **Step 2 : tests qui échouent**

```tsx
// src/components/admin/contest/__tests__/access-panel.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AccessPanel } from '../AccessPanel'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})

test('aperçu = le PNG carte servi par la route', () => {
  render(<AccessPanel contestId={7} secret="k3f9" />)
  expect(screen.getByRole('img', { name: 'QR code du concours' }).getAttribute('src')).toBe('/api/admin/concours/7/qr?format=carte')
})

test('deux exports : carte entière et QR seul', () => {
  render(<AccessPanel contestId={7} secret="k3f9" />)
  expect(screen.getByRole('link', { name: /PNG carte/ }).getAttribute('href')).toBe('/api/admin/concours/7/qr?format=carte&download=1')
  expect(screen.getByRole('link', { name: /PNG QR seul/ }).getAttribute('href')).toBe('/api/admin/concours/7/qr?format=qr&download=1')
})

test('URL affichée et copiable', async () => {
  render(<AccessPanel contestId={7} secret="k3f9" />)
  expect(await screen.findByText(`${window.location.origin}/concours/k3f9`)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/concours/k3f9`))
  expect(await screen.findByText('Copié')).toBeTruthy()
})

test('partager : fichier PNG passé au partage natif quand il est disponible', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['png'], { type: 'image/png' }))))
  render(<AccessPanel contestId={7} secret="k3f9" />)
  fireEvent.click(screen.getByRole('button', { name: /Partager/ }))
  await waitFor(() => expect(share).toHaveBeenCalled())
  const files = share.mock.calls[0][0].files as File[]
  expect(files[0].type).toBe('image/png')
})
```

- [ ] **Step 3 :** lancer → FAIL.

- [ ] **Step 4 : implémentation**

```tsx
// src/components/admin/contest/AccessPanel.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCopy, IconDownload, IconShare } from '@/components/icons'

// Bloc « Accès invités » (spec PR 2 §4). L'aperçu EST le PNG exporté : ce que
// l'organisateur voit est exactement ce qu'il imprime ou partage.
export function AccessPanel({ contestId, secret }: { contestId: number; secret: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [imgError, setImgError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const png = (format: 'carte' | 'qr', download = false) => `/api/admin/concours/${contestId}/qr?format=${format}${download ? '&download=1' : ''}`

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(`${window.location.origin}/concours/${secret}`)
  }, [secret])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papier indisponible : l'URL reste lisible et sélectionnable.
    }
  }

  // Partage natif du fichier (téléphone, macOS) ; sinon on télécharge la carte.
  // Une annulation par l'utilisateur (AbortError) n'est pas une erreur.
  const share = async () => {
    try {
      const blob = await (await fetch(png('carte'))).blob()
      const file = new File([blob], 'concours-carte.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    window.location.assign(png('carte', true))
  }

  const btn = 'flex items-center gap-1.5 rounded-[var(--radius-field)] border border-[color:var(--border-strong)] px-2.5 py-1.5 text-[12px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)]'

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Accès invités</h3>
      <div className="flex items-start gap-3">
        {imgError ? (
          <p className="flex-1 text-[13px] text-[color:var(--danger)]">QR code indisponible — utilise le lien ci-dessous.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- PNG dynamique protégé par session, pas d'optimisation voulue
          <img src={png('carte')} alt="QR code du concours" onError={() => setImgError(true)} className="w-[140px] rounded-[var(--radius-field)]" />
        )}
        <div className="flex flex-col gap-2">
          <a href={png('carte', true)} className={btn}><IconDownload size={14} />PNG carte</a>
          <a href={png('qr', true)} className={btn}><IconDownload size={14} />PNG QR seul</a>
          <button type="button" onClick={share} className={btn}><IconShare size={14} />Partager</button>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-[var(--radius-field)] bg-[color:var(--surface-2)] px-2 py-1.5">
        <code className="flex-1 truncate text-[12px] text-[color:var(--text-muted)]">{url}</code>
        {copied && <span className="text-[12px] text-[color:var(--accent-ink)]">Copié</span>}
        <button type="button" aria-label="Copier le lien" onClick={copy} className="text-[color:var(--accent-ink)]"><IconCopy size={14} /></button>
      </div>
    </div>
  )
}
```

`PilotPanel.tsx`, nouveau rendu (garder `ERR`, `busy`, `step`, `error`) :

```tsx
  const block = 'flex flex-col gap-2 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-3'
  const caption = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]'
  const inReveal = contest.phase === 'reveal'
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display border-b-2 border-[color:var(--border)] pb-2 text-[20px] text-[color:var(--text-strong)]">Pilotage</h2>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}

      <div className={block}>
        <h3 className={caption}>Scène</h3>
        <a href={`/admin/concours/${contest.id}/scene`} target="_blank" rel="noopener noreferrer" className={`${btn} flex items-center gap-1.5 self-start`}>
          Ouvrir la scène <IconExternal size={14} />
        </a>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} disabled={busy || !inReveal || contest.revealStep === 0} onClick={() => step(contest.revealStep - 1)}>‹ Étape</button>
          <span className="text-[13px] text-[color:var(--text-muted)]">{inReveal ? `${contest.revealStep + 1}/${steps.length}` : `—/${steps.length}`}</span>
          <button type="button" className={btn} disabled={busy || !inReveal || contest.revealStep >= steps.length - 1} onClick={() => step(contest.revealStep + 1)}>Étape ›</button>
        </div>
        {!inReveal && <p className="text-[12px] text-[color:var(--text-muted)]">Les étapes se débloquent en Révélation.</p>}
      </div>

      <AccessPanel contestId={contest.id} secret={contest.secret} />

      <div className={block}>
        <div className="flex items-center">
          <h3 className={`${caption} flex-1`}>Classement en direct</h3>
          <button type="button" aria-label={showLive ? 'Masquer le classement en direct' : 'Afficher le classement en direct'} aria-pressed={showLive}
            onClick={() => setShowLive(!showLive)} className={btn}>
            {showLive ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
        </div>
        {showLive ? (
          <ol className="flex flex-col gap-1 text-[13px] text-[color:var(--text-body)]">
            {rows.map((r) => (
              <li key={r.plateId}>{r.position ?? '—'}. Assiette {r.number} — {r.score ?? '—'}/100 ({r.votes} voix) {r.authors.join(' & ')}</li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-[color:var(--text-muted)]">Masqué. Clique sur l’œil pour l’afficher.</p>
        )}
      </div>
    </section>
  )
```

Supprimer `ContestQr.tsx` (`git rm`). Dans `pilot-panel.test.tsx`, remplacer le mock de `../ContestQr` par `vi.mock('../AccessPanel', () => ({ AccessPanel: () => null }))`, retirer `guests`/`complete` devenus inutiles s'ils ne servent plus, et adapter les libellés des boutons d'étape (`‹ Étape`, `Étape ›`) ; ajouter :

```tsx
test('hors révélation : étapes grisées et explication', () => {
  render(<PilotPanel view={view('voting')} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Étape ›' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Les étapes se débloquent en Révélation.')).toBeTruthy()
})

test('œil : classement masqué par défaut, affiché au clic', () => {
  render(<PilotPanel view={view('voting')} onDone={vi.fn()} />)
  expect(screen.getByText('Masqué. Clique sur l’œil pour l’afficher.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Afficher le classement en direct' }))
  expect(screen.getByRole('button', { name: 'Masquer le classement en direct' })).toBeTruthy()
})
```

- [ ] **Step 5 :** `npx vitest run src/components/admin/contest` → PASS ; `npm run lint` → 0 erreur.

- [ ] **Step 6 : commit** — `feat(concours): blocs Scène, Accès invités (export et partage du QR) et classement en direct`

---

### Task 7 : `releaseSelfAction` (changer de nom côté serveur)

**Files:**
- Modify: `src/lib/contest-db.ts`, `src/lib/contest-identity.ts`, `src/app/actions/contest-guest.ts`
- Test: `src/app/actions/__tests__/contest-guest.test.ts`

**Interfaces:**
- Produces: `releaseSelf(contestId: number, guestId: number): Promise<void>` (transaction : supprime le bulletin, vide `claim_token`) ; `clearGuestToken(contestId: number): Promise<void>` ; `releaseSelfAction(secret: string): Promise<{ ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'locked' }>`.

- [ ] **Step 1 : tests qui échouent.** Dans `contest-guest.test.ts`, ajouter `releaseSelf: vi.fn()` à `db` et à son `vi.mock`, `clearGuestToken: vi.fn()` à `identity` et à son `vi.mock`, importer `releaseSelfAction`, puis :

```ts
test('changer de nom en vote : bulletin effacé, jeton vidé, cookie supprimé', async () => {
  expect(await releaseSelfAction('s')).toEqual({ ok: true })
  expect(db.releaseSelf).toHaveBeenCalledWith(1, 5)
  expect(identity.clearGuestToken).toHaveBeenCalledWith(1)
})

test('changer de nom en préparation : autorisé', async () => {
  db.getContestBySecret.mockResolvedValue({ ...contest, phase: 'preparation' })
  expect(await releaseSelfAction('s')).toEqual({ ok: true })
})

test('changer de nom après la clôture : refusé, rien touché', async () => {
  for (const phase of ['closed', 'reveal']) {
    db.getContestBySecret.mockResolvedValue({ ...contest, phase })
    expect(await releaseSelfAction('s')).toEqual({ ok: false, error: 'locked' })
  }
  expect(db.releaseSelf).not.toHaveBeenCalled()
  expect(identity.clearGuestToken).not.toHaveBeenCalled()
})

test('changer de nom sans identité ou concours inconnu', async () => {
  db.findGuestIdByToken.mockResolvedValue(null)
  expect(await releaseSelfAction('s')).toEqual({ ok: false, error: 'no-identity' })
  db.getContestBySecret.mockResolvedValue(null)
  expect(await releaseSelfAction('x')).toEqual({ ok: false, error: 'not-found' })
  expect(db.releaseSelf).not.toHaveBeenCalled()
})
```

- [ ] **Step 2 :** lancer → FAIL.

- [ ] **Step 3 : implémentation**

```ts
// contest-db.ts, après releaseGuest
// L'invité s'est trompé de nom (spec PR 2 §5) : son bulletin a été fait par la
// mauvaise personne, on l'efface avec la réservation, en une transaction.
export async function releaseSelf(contestId: number, guestId: number): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`DELETE FROM contest_ballots WHERE guest_id = ${guestId}
        AND guest_id IN (SELECT id FROM contest_guests WHERE contest_id = ${contestId})`,
    sql`UPDATE contest_guests SET claim_token = NULL WHERE id = ${guestId} AND contest_id = ${contestId}`,
  ])
}
```

```ts
// contest-identity.ts
export async function clearGuestToken(contestId: number): Promise<void> {
  ;(await cookies()).delete(guestCookieName(contestId))
}
```

```ts
// contest-guest.ts (compléter les imports)
type ReleaseResult = { ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'locked' }

export async function releaseSelfAction(secret: string): Promise<ReleaseResult> {
  const contest = await getContestBySecret(secret)
  if (!contest) return { ok: false, error: 'not-found' }
  const token = await readGuestToken(contest.id)
  const guestId = token ? await findGuestIdByToken(contest.id, token) : null
  if (guestId === null) return { ok: false, error: 'no-identity' }
  if (contest.phase !== 'preparation' && contest.phase !== 'voting') return { ok: false, error: 'locked' }
  await releaseSelf(contest.id, guestId)
  await clearGuestToken(contest.id)
  return { ok: true }
}
```

- [ ] **Step 4 :** `npx vitest run src/app/actions` → PASS.

- [ ] **Step 5 : commit** — `feat(concours): un invité peut libérer son nom (bulletin effacé)`

---

### Task 8 : Textes i18n, `ordinal()` et `podium()`

**Files:**
- Modify: `src/lib/contest-i18n.ts`, `src/lib/__tests__/contest-i18n.test.ts`
- Create: `src/lib/contest-podium.ts`, `src/lib/__tests__/contest-podium.test.ts`

**Interfaces:**
- Produces:
  - clés `closedTitle`, `closedBody`, `revealTitle`, `changeName`, `notYou`, `changeNameBody`, `changeNameConfirm`, `changeNameFailed`, `plateTag`, `verdict`, `ballotsPlates`, `bakedBy`, `ptsAhead`, `waitingReveal`, `finalRanking`, `authorsHidden` ; clé `eyesOnScreen` supprimée ;
  - `ordinal(lang: Lang, n: number): string` (`fr` : 1er, 2e… ; `en` : 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st…) ;
  - `podium(rows: ResultRow[]): { first: ResultRow[]; second: ResultRow[]; third: ResultRow[]; rest: ResultRow[] }` — `first/second/third` = lignes de position 1 / 2 / 3 (ex æquo inclus, éventuellement vides) ; `rest` = positions > 3 puis non classées, dans l'ordre reçu.

- [ ] **Step 1 : tests qui échouent**

```ts
// ajouts à contest-i18n.test.ts (et remplacer la ligne eyesOnScreen par :)
  expect(contestDict.fr.closedTitle).toBe('Votes clos')

test('ordinaux FR et EN', () => {
  expect([1, 2, 10].map((n) => ordinal('fr', n))).toEqual(['1er', '2e', '10e'])
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map((n) => ordinal('en', n)))
    .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'])
})
```

(import : `import { contestDict, fmt, ordinal } from '../contest-i18n'`)

```ts
// src/lib/__tests__/contest-podium.test.ts
import { expect, test } from 'vitest'
import type { ResultRow } from '../contest-state'
import { podium } from '../contest-podium'

const row = (plateId: number, position: number | null): ResultRow => ({
  plateId, number: plateId, label: null, authors: [], position, score: position === null ? null : 100 - position,
  avgRank: null, votes: 0, bestRank: null, worstRank: null, firsts: 0,
})

test('cas simple : trois marches et le reste', () => {
  const p = podium([row(1, 1), row(2, 2), row(3, 3), row(4, 4), row(5, null)])
  expect(p.first.map((r) => r.plateId)).toEqual([1])
  expect(p.second.map((r) => r.plateId)).toEqual([2])
  expect(p.third.map((r) => r.plateId)).toEqual([3])
  expect(p.rest.map((r) => r.plateId)).toEqual([4, 5])
})

test('deux 1ers ex æquo : pas de 2e, la marche 3 existe', () => {
  const p = podium([row(1, 1), row(2, 1), row(3, 3), row(4, 4)])
  expect(p.first.map((r) => r.plateId)).toEqual([1, 2])
  expect(p.second).toEqual([])
  expect(p.third.map((r) => r.plateId)).toEqual([3])
})

test('moins de 3 assiettes classées', () => {
  const p = podium([row(1, 1), row(2, null)])
  expect(p.first).toHaveLength(1)
  expect(p.second).toEqual([])
  expect(p.third).toEqual([])
  expect(p.rest.map((r) => r.plateId)).toEqual([2])
})
```

- [ ] **Step 2 :** lancer `npx vitest run src/lib` → FAIL.

- [ ] **Step 3 : implémentation.** Dans `contest-i18n.ts`, supprimer `eyesOnScreen` des deux dictionnaires, remplacer `closedBody` et ajouter (FR puis EN, **apostrophes `’`**) :

| clé | fr | en |
|---|---|---|
| `closedTitle` | `Votes clos` | `Voting closed` |
| `closedBody` | `Ton classement est enregistré.` | `Your ranking is saved.` |
| `revealTitle` | `Révélation en cours` | `Reveal in progress` |
| `changeName` | `Changer de nom` | `Change name` |
| `notYou` | `Tu n’es pas {name} ?` | `Not {name}?` |
| `changeNameBody` | `Tu reviendras à la liste des noms. Le classement fait sous « {name} » sera effacé.` | `You’ll go back to the list of names. The ranking made as “{name}” will be erased.` |
| `changeNameConfirm` | `Changer de nom` | `Change name` |
| `changeNameFailed` | `Impossible de changer de nom maintenant.` | `Can’t change name right now.` |
| `plateTag` | `N° {n}` | `No. {n}` |
| `verdict` | `Le verdict` | `The verdict` |
| `ballotsPlates` | `{b} bulletins · {p} assiettes` | `{b} ballots · {p} plates` |
| `bakedBy` | `fait par` | `baked by` |
| `ptsAhead` | `+{n} pts devant le {k}` | `{n} pts ahead of {k}` |
| `waitingReveal` | `En attente de la révélation…` | `Waiting for the reveal…` |
| `finalRanking` | `Classement final` | `Final ranking` |
| `authorsHidden` | `Auteurs à venir` | `Bakers coming up` |

Puis, en bas du fichier :

```ts
// Rang écrit en toutes lettres courtes (scène et récapitulatif) : 1er/2e en
// français, 1st/2nd/3rd/11th en anglais — 11, 12 et 13 font exception.
export function ordinal(lang: Lang, n: number): string {
  if (lang === 'fr') return n === 1 ? '1er' : `${n}e`
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}
```

Retirer les clés `rank` et `firstRank` **seulement** si plus aucun fichier ne les utilise après les Tasks 9-11 (sinon les laisser).

```ts
// src/lib/contest-podium.ts
import type { ResultRow } from './contest-state'

// Pyramide de l'écran final (spec PR 2 §6-7). Les positions suivent le rang de
// compétition (1, 1, 3) : deux 1ers ex æquo laissent la marche 2 vide.
export function podium(rows: ResultRow[]) {
  const at = (p: number) => rows.filter((r) => r.position === p)
  return {
    first: at(1),
    second: at(2),
    third: at(3),
    rest: rows.filter((r) => r.position === null || r.position > 3),
  }
}
```

Mettre à jour `ContestGuestApp.tsx` : `t('eyesOnScreen')` → `t('closedTitle')` (le rendu complet arrive en Task 9) ; dans `guest-app.test.tsx`, le test « révélation en cours » attend désormais `Révélation en cours` — il échouera jusqu'à la Task 9, donc faire ce changement de test en Task 9 et, ici, remplacer temporairement l'attente par `Votes clos` pour garder la suite verte.

- [ ] **Step 4 :** `npx vitest run` → PASS (suite complète).

- [ ] **Step 5 : commit** — `feat(concours): textes clos/révélation, ordinaux et pyramide du podium`

---

### Task 9 : Écrans invités — en-tête, changer de nom, clos / révélation

**Files:**
- Create: `src/components/contest/ChangeNameSheet.tsx`
- Modify: `src/components/contest/ContestGuestApp.tsx`
- Test: `src/components/contest/__tests__/guest-app.test.tsx`

**Interfaces:**
- Consumes: `releaseSelfAction` (Task 7), clés i18n (Task 8).
- Produces: `<ChangeNameSheet name={string} t={T} onConfirm={() => Promise<boolean>} onClose={() => void} />`.

- [ ] **Step 1 : tests qui échouent.** Dans `guest-app.test.tsx`, ajouter `releaseSelfAction` au mock de `@/app/actions/contest-guest` (`releaseSelfAction: (...a: unknown[]) => releaseSelfAction(...a)`, `mockResolvedValue({ ok: true })` dans `beforeEach`), puis :

```tsx
test('révélation en cours : titre dédié, rien n’est dévoilé', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, phase: 'reveal', me: { id: 1, name: 'Julie' } }} />)
  expect(await screen.findByText('Révélation en cours')).toBeTruthy()
})

test('votes clos : titre et classement enregistré', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, phase: 'closed', me: { id: 1, name: 'Julie' } }} />)
  expect(await screen.findByText('Votes clos')).toBeTruthy()
  expect(screen.getByText('Ton classement est enregistré.')).toBeTruthy()
})

test('changer de nom : confirmation puis retour à « Qui es-tu ? » sans message de libération', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  const me = { ...base, me: { id: 1, name: 'Julie' } }
  // Le serveur renvoie l'état sans identité après la libération.
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(me)))
    .mockResolvedValue(new Response(JSON.stringify(base))))
  render(<ContestGuestApp secret="s" initial={me} />)
  fireEvent.click(await screen.findByRole('button', { name: /Julie/ }))
  expect(screen.getByText('Tu n’es pas Julie ?')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Changer de nom' }))
  await waitFor(() => expect(releaseSelfAction).toHaveBeenCalledWith('s'))
  expect(await screen.findByText('Qui es-tu ?')).toBeTruthy()
  expect(screen.queryByText('Ton nom a été libéré : choisis-le à nouveau.')).toBeNull()
})

test('changer de nom refusé : message dans la feuille', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  releaseSelfAction.mockResolvedValue({ ok: false, error: 'locked' })
  render(<ContestGuestApp secret="s" initial={{ ...base, me: { id: 1, name: 'Julie' } }} />)
  fireEvent.click(await screen.findByRole('button', { name: /Julie/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Changer de nom' }))
  expect(await screen.findByText('Impossible de changer de nom maintenant.')).toBeTruthy()
})

test('après la clôture : le prénom n’est plus un bouton', async () => {
  localStorage.setItem('cc_concours_lang', 'fr')
  render(<ContestGuestApp secret="s" initial={{ ...base, phase: 'closed', me: { id: 1, name: 'Julie' } }} />)
  await screen.findByText('Votes clos')
  expect(screen.queryByRole('button', { name: /Julie/ })).toBeNull()
  expect(screen.getByText('Julie')).toBeTruthy()
})
```

Supprimer l'ancien test « révélation en cours : rien n’est dévoilé » (remplacé).

- [ ] **Step 2 :** lancer → FAIL.

- [ ] **Step 3 : feuille**

```tsx
// src/components/contest/ChangeNameSheet.tsx
'use client'

import { useState } from 'react'
import type { ContestMsgKey } from '@/lib/contest-i18n'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

// Feuille par le bas (spec PR 2 §5). Prévient franchement que le classement
// sera effacé : c'est le seul geste destructif côté invité.
export function ChangeNameSheet({ name, t, onConfirm, onClose }: {
  name: string; t: T; onConfirm: () => Promise<boolean>; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="change-name-title" className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-[var(--radius-sheet)] bg-[color:var(--surface)] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <h2 id="change-name-title" className="font-display text-[22px] text-[color:var(--text-strong)]">{t('notYou', { name })}</h2>
        <p className="text-[15px] text-[color:var(--text-body)]">{t('changeNameBody', { name })}</p>
        {failed && <p className="text-[14px] text-[color:var(--danger)]">{t('changeNameFailed')}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await onConfirm()
            setBusy(false)
            setFailed(!ok)
          }}
          className="rounded-[var(--radius-card)] bg-[color:var(--btn-bg)] px-6 py-4 text-[17px] font-medium text-[color:var(--btn-text)] disabled:opacity-60"
        >
          {t('changeNameConfirm')}
        </button>
        <button type="button" onClick={onClose} className="text-[15px] text-[color:var(--text-muted)] underline">{t('cancel')}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : `ContestGuestApp`**
  - État : `const [sheetOpen, setSheetOpen] = useState(false)`.
  - Action :
    ```tsx
    // Changer de nom (spec PR 2 §5) : le bulletin est effacé côté serveur. On
    // oublie tout envoi en attente (sinon il repartirait sous l'identité vide) et
    // on abaisse `hadIdentity` AVANT la relecture, pour que la perte d'identité ne
    // soit pas prise pour une libération par l'organisateur.
    const changeName = async (): Promise<boolean> => {
      try {
        const res = await releaseSelfAction(secret)
        if (!res.ok) return false
      } catch {
        return false
      }
      unsent.current = null
      sendSeq.current++
      hadIdentity.current = false
      setRanking([])
      setSheetOpen(false)
      await refresh(true)
      return true
    }
    ```
  - `canChangeName = view.me !== null && (view.phase === 'preparation' || view.phase === 'voting')`.
  - En-tête (remplace l'actuel) :
    ```tsx
    <header className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marque statique */}
      <img src="/brand/logo.svg" alt="" className="h-7 w-7" />
      <span className="font-display flex-1 truncate text-[15px] text-[color:var(--text-strong)]">{view.name}</span>
      {lang && view.me && (canChangeName ? (
        <button type="button" onClick={() => setSheetOpen(true)} aria-label={`${view.me.name} — ${t('changeName')}`}
          className="flex items-center gap-1 rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[13px] text-[color:var(--text-body)]">
          {view.me.name}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      ) : (
        <span className="text-[13px] text-[color:var(--text-body)]">{view.me.name}</span>
      ))}
      {lang && (
        <button type="button" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[12px] text-[color:var(--text-body)]">
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>
      )}
    </header>
    ```
    (La clé `hello` n'est plus utilisée : la supprimer des deux dictionnaires.)
  - Rendu de la feuille, après le `body` : `{sheetOpen && view.me && lang && <ChangeNameSheet name={view.me.name} t={t} onConfirm={changeName} onClose={() => setSheetOpen(false)} />}` ; fermer la feuille si la phase n'autorise plus le changement : ajouter `if (sheetOpen && !canChangeName) setSheetOpen(false)` dans le rendu (ajustement d'état pendant le rendu, même motif que `Scene.tsx`).
  - Branche clos / révélation :
    ```tsx
    body = (
      <div className="flex flex-col gap-6">
        <div className="pt-6 text-center">
          <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t(view.phase === 'reveal' ? 'revealTitle' : 'closedTitle')}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--text-body)]">{t('closedBody')}</p>
        </div>
        <RankingBoard plates={view.plates} ranking={ranking} onChange={() => {}} locked t={t} />
      </div>
    )
    ```

- [ ] **Step 5 :** `npx vitest run src/components/contest` → PASS ; `npx vitest run src/lib` (clé `hello` supprimée) → PASS.

- [ ] **Step 6 : commit** — `feat(concours): changer de nom côté invité, écrans votes clos et révélation`

---

### Task 10 : Étiquette « N° X » et polish des écrans invités

**Files:**
- Create: `src/components/contest/PlateTag.tsx`
- Modify: `src/components/contest/RankingBoard.tsx`, `LanguagePicker.tsx`, `NamePicker.tsx`
- Test: `src/components/contest/__tests__/plate-tag.test.tsx`, `ranking-board.test.tsx` (adapter)

**Interfaces:**
- Consumes: clé `plateTag` (Task 8).
- Produces: `<PlateTag number={number} label={string} size="sm" | "md" | "lg" | "xl" tilt?={boolean} score?={number | null} scoreLabel?={string} />` — `label` est le texte « N° 3 » déjà traduit ; utilisé par la scène (Task 11) et le podium.

- [ ] **Step 1 : test qui échoue**

```tsx
// src/components/contest/__tests__/plate-tag.test.tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { PlateTag } from '../PlateTag'

afterEach(cleanup)

test('affiche le numéro, et la note si fournie', () => {
  render(<PlateTag number={3} label="N° 3" size="lg" score={82} scoreLabel="82/100" />)
  expect(screen.getByText('N° 3')).toBeTruthy()
  expect(screen.getByText('82/100')).toBeTruthy()
})

test('sans note : pas de ligne de score', () => {
  const { container } = render(<PlateTag number={3} label="N° 3" size="sm" />)
  expect(container.textContent).toBe('N° 3')
})
```

- [ ] **Step 2 :** lancer → FAIL.

- [ ] **Step 3 : implémentation**

```tsx
// src/components/contest/PlateTag.tsx
// Étiquette d'assiette crème (spec PR 2 §6-7), la même sur la scène et sur les
// téléphones : « N° X » en grand, jamais d'icône. Couleurs fixes (crème et
// chocolat) quel que soit le thème : c'est un objet, comme l'étiquette posée
// sur la table.
const SIZES = {
  sm: { box: 'min-w-[44px] px-2 py-1.5 rounded-[8px]', num: 'text-[15px]', score: 'text-[10px]' },
  md: { box: 'min-w-[64px] px-3 py-2 rounded-[10px]', num: 'text-[20px]', score: 'text-[11px]' },
  lg: { box: 'min-w-[220px] px-8 py-8 rounded-[24px]', num: 'text-[64px]', score: 'text-[28px]' },
  xl: { box: 'min-w-[280px] px-10 py-10 rounded-[28px]', num: 'text-[84px]', score: 'text-[34px]' },
} as const

export function PlateTag({ label, size, tilt = false, score, scoreLabel }: {
  number: number; label: string; size: keyof typeof SIZES; tilt?: boolean; score?: number | null; scoreLabel?: string
}) {
  const s = SIZES[size]
  return (
    <span
      className={`inline-flex flex-col items-center justify-center bg-[#fffdf9] text-[#2c1f16] shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${s.box}`}
      style={tilt ? { transform: 'rotate(-3deg)' } : undefined}
    >
      <span className={`font-display leading-none ${s.num}`}>{label}</span>
      {score != null && scoreLabel && <span className={`mt-1 ${s.score}`}>{scoreLabel}</span>}
    </span>
  )
}
```

- [ ] **Step 4 : `RankingBoard`.**
  - Pastilles « À goûter » : remplacer le contenu du bouton par `<PlateTag number={p.number} label={t('plateTag', { n: p.number })} size="md" />` et la classe du bouton par `rounded-[10px] ${activePick === p.id ? 'ring-4 ring-[color:var(--btn-bg)]' : ''}` (garder `aria-pressed`). Donner au bouton `aria-label={t('plate', { n: p.number })}` pour que les tests et lecteurs d'écran gardent « Assiette N ».
  - `RankedRow` : rang en `text-[22px] text-[color:var(--btn-bg)]`, puis `<PlateTag number={plate.number} label={t('plateTag', { n: plate.number })} size="sm" tilt />` avant le bloc texte ; le reste inchangé.
  - Lire `ranking-board.test.tsx` : les requêtes `getByRole('button', { name: 'Assiette 2' })` restent valides grâce à `aria-label` ; corriger celles qui cherchaient le texte visible.
- [ ] **Step 5 : `LanguagePicker`** : ajouter en tête `<img src="/brand/logo.svg" alt="" className="h-24 w-24" />` (avec le commentaire eslint `no-img-element` comme en Task 9) ; titre bilingue sur deux lignes, la ligne anglaise en `text-[18px] italic text-[color:var(--text-muted)]`. **`NamePicker`** : aucun changement de fond ; boutons de nom en `rounded-[var(--radius-card)] border-[color:var(--border-strong)]`.

- [ ] **Step 6 :** `npx vitest run src/components/contest` → PASS.

- [ ] **Step 7 : commit** — `feat(concours): étiquettes N° X et habillage des écrans invités`

---

### Task 11 : Podium partagé, récapitulatif invité et scène

**Files:**
- Create: `src/components/contest/Podium.tsx`
- Modify: `src/components/contest/GuestResults.tsx`, `src/components/admin/contest/Scene.tsx`
- Test: `src/components/contest/__tests__/podium.test.tsx`, `src/components/admin/contest/__tests__/scene.test.tsx` (adapter + ajouts)

**Interfaces:**
- Consumes: `podium()` et `ordinal()` (Task 8), `PlateTag` (Task 10), `contestDict`, `fmt`.
- Produces: `<Podium rows={ResultRow[]} size="phone" | "tv" text={(k, vars?) => string} lang={Lang} />` — rend les marches 2 / 1 / 3 (une marche vide n'est pas rendue) ; la liste du reste est rendue par l'appelant.

- [ ] **Step 1 : tests qui échouent**

```tsx
// src/components/contest/__tests__/podium.test.tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { contestDict, fmt, type ContestMsgKey } from '@/lib/contest-i18n'
import type { ResultRow } from '@/lib/contest-state'
import { Podium } from '../Podium'

afterEach(cleanup)
const t = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
const row = (plateId: number, position: number | null, authors: string[] = []): ResultRow => ({
  plateId, number: plateId, label: null, authors, position, score: 90 - plateId,
  avgRank: 1.5, votes: 3, bestRank: 1, worstRank: 3, firsts: 1,
})

test('ordre visuel 2e, 1er, 3e avec auteurs', () => {
  render(<Podium rows={[row(1, 1, ['Inès']), row(2, 2, ['Camille', 'Hugo']), row(3, 3, ['Léo'])]} size="phone" text={t} lang="fr" />)
  const steps = screen.getAllByTestId('podium-step')
  expect(steps.map((s) => s.dataset.position)).toEqual(['2', '1', '3'])
  expect(steps[0].textContent).toContain('Camille & Hugo')
})

test('ex æquo en tête : deux étiquettes sur la marche 1, pas de marche 2', () => {
  render(<Podium rows={[row(1, 1), row(2, 1), row(3, 3)]} size="phone" text={t} lang="fr" />)
  const steps = screen.getAllByTestId('podium-step')
  expect(steps.map((s) => s.dataset.position)).toEqual(['1', '3'])
  expect(steps[0].textContent).toContain('N° 1')
  expect(steps[0].textContent).toContain('N° 2')
})
```

Dans `scene.test.tsx` (le lire d'abord : il rend `<Scene initial={…} />` avec `fetch` stubbé), ajouter :

```tsx
test('scène bilingue : titre FR et EN', async () => {
  // construire une vue en phase reveal, revealStep 0 (étape titre), avec la fabrique du fichier
  render(<Scene initial={viewAt('reveal', 0)} />)
  expect(await screen.findByText('Le verdict')).toBeTruthy()
  expect(screen.getByText('The verdict')).toBeTruthy()
})

test('rang, premier temps : auteurs masqués ; second temps : auteurs', async () => {
  // étapes : [title, plate(pos 2, showAuthors false), plate(pos 2, true), …]
  render(<Scene initial={viewAt('reveal', 1)} />)
  expect(await screen.findByText('Auteurs à venir')).toBeTruthy()
  cleanup()
  render(<Scene initial={viewAt('reveal', 2)} />)
  expect(await screen.findByText('Camille & Hugo')).toBeTruthy()
})

test('écran final : pyramide puis liste', async () => {
  render(<Scene initial={viewAt('reveal', LAST)} />)
  expect((await screen.findAllByTestId('podium-step')).length).toBeGreaterThan(0)
  expect(screen.getByText('Classement final')).toBeTruthy()
})
```

(Adapter `viewAt`/`LAST` à la fabrique existante du fichier ; si elle n'existe pas, en créer une qui construit un `AdminView` avec `rows` de 4 assiettes, positions 1..4, et `steps = buildRevealSteps(rows)` importé de `@/lib/contest-reveal`.)

- [ ] **Step 2 :** lancer → FAIL.

- [ ] **Step 3 : `Podium`**

```tsx
// src/components/contest/Podium.tsx
import type { ContestMsgKey } from '@/lib/contest-i18n'
import { ordinal } from '@/lib/contest-i18n'
import { podium } from '@/lib/contest-podium'
import type { ResultRow } from '@/lib/contest-state'
import type { Lang } from '@/lib/i18n'
import { PlateTag } from './PlateTag'

type Text = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

// Pyramide des 3 premiers (spec PR 2 §6-7) : 2e à gauche, 1er au centre et
// plus haut, 3e à droite. Marche vide (ex æquo au-dessus) : non rendue.
export function Podium({ rows, size, text, lang }: { rows: ResultRow[]; size: 'phone' | 'tv'; text: Text; lang: Lang }) {
  const p = podium(rows)
  const tv = size === 'tv'
  const steps = [
    { position: 2, rows: p.second, lift: tv ? 'pt-16' : 'pt-6' },
    { position: 1, rows: p.first, lift: 'pt-0' },
    { position: 3, rows: p.third, lift: tv ? 'pt-24' : 'pt-10' },
  ].filter((s) => s.rows.length > 0)

  return (
    <div className="flex items-start justify-center gap-4">
      {steps.map((s) => (
        <div key={s.position} data-testid="podium-step" data-position={s.position} className={`flex flex-col items-center gap-2 ${s.lift}`}>
          <span className={`font-display leading-none ${s.position === 1 ? (tv ? 'text-[88px] text-[#f3c787]' : 'text-[36px] text-[#f3c787]') : (tv ? 'text-[64px] text-[#d29a55]' : 'text-[28px] text-[#d29a55]')}`}>
            {ordinal(lang, s.position)}
          </span>
          <div className="flex gap-2">
            {s.rows.map((r) => (
              <div key={r.plateId} className="flex flex-col items-center gap-1 text-center">
                <PlateTag number={r.number} label={text('plateTag', { n: r.number })} size={tv ? 'md' : 'sm'} tilt score={r.score} scoreLabel={r.score === null ? undefined : text('score', { n: r.score })} />
                <span className={`font-display ${tv ? 'text-[26px]' : 'text-[14px]'} text-[#7f98e0]`}>{r.authors.join(' & ') || '?'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

(Sur téléphone en thème clair, le bleu `#7f98e0` et les dorés sont peu contrastés : pour `size="phone"`, remplacer ces trois couleurs fixes par `var(--phase-reveal)` et `var(--accent-ink)` — vérifier visuellement dans les deux thèmes en Task 12.)

- [ ] **Step 4 : `GuestResults`** : au début de la première section, remplacer la liste complète par `<Podium rows={results.rows} size="phone" text={t} lang={lang} />` suivie de `<ol>` des seules lignes `podium(results.rows).rest` (composant `Row` inchangé, sauf `rankLabel` → `row.position === null ? t('unranked') : ordinal(lang, row.position)`). Supprimer les clés `rank`/`firstRank` si plus utilisées nulle part (`grep -rn "'rank'\|firstRank" src`).

- [ ] **Step 5 : `Scene`** — **ne pas toucher** à la mécanique (états, `useEffect` clavier, `effectiveStep`, indicateur). Remplacer uniquement la construction de `body` :
  - Helper local bilingue :
    ```tsx
    const fr = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
    const en = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.en[k], v) : contestDict.en[k])
    function Bi({ k, v, className }: { k: ContestMsgKey; v?: Record<string, string | number>; className: string }) {
      return (
        <div className="flex flex-col items-center">
          <span className={className}>{fr(k, v)}</span>
          <span className="text-[0.45em] italic opacity-60">{en(k, v)}</span>
        </div>
      )
    }
    ```
    (déclarés au niveau module, hors du composant.)
  - Fond commun : `const shell = 'relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden p-12 text-center text-[#f4ebdd]'` avec `style={{ background: 'radial-gradient(circle at 50% 45%, #3d2e20, #1f170f 75%)' }}` ; logo `<img src="/brand/logo.svg" alt="" className="absolute left-6 top-6 h-16 w-16" />` ; points de progression en bas :
    ```tsx
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden="true">
      {steps.map((_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full bg-[#f4ebdd] ${i <= effectiveStep ? 'opacity-90' : 'opacity-25'}`} />)}
    </div>
    ```
    La scène reste sombre quel que soit le thème (c'est une TV) : couleurs fixes, pas de jetons de thème.
  - Attente : nom du concours (`font-display text-[72px]`) + `<Bi k="waitingReveal" className="text-[32px]" />`.
  - Titre : `<Bi k="verdict" className="font-display text-[110px] leading-none" />` + `<Bi k="ballotsPlates" v={{ b: voters, p: rows.length }} className="text-[32px]" />`.
  - Rang (`step.kind === 'plate'`) : conteneur `flex items-center gap-16` :
    - à gauche `<div className="flex flex-col items-center"><span className={`font-display leading-none ${step.position === 1 ? 'text-[260px] text-[#f3c787] [text-shadow:0_0_60px_rgba(243,199,135,0.4)]' : step.podium ? 'text-[220px] text-[#d29a55]' : 'text-[180px] text-[#d29a55]'}`}>{ordinal('fr', step.position)}</span><span className="text-[36px] italic opacity-60">{ordinal('en', step.position)}</span></div>` ;
    - au centre, pour chaque assiette de `shown` : `<PlateTag number={r.number} label={fr('plateTag', { n: r.number })} size={step.position === 1 ? 'xl' : 'lg'} tilt score={r.score} scoreLabel={r.score === null ? undefined : fr('score', { n: r.score })} />`, avec la note facultative `r.label` en dessous (`text-[22px] opacity-70`) ;
    - à droite, colonne alignée à gauche : `<Bi k="bakedBy" className="text-[24px]" />` puis, si `step.showAuthors`, les auteurs `font-display text-[64px] text-[#7f98e0]` (un bloc par assiette si ex æquo), sinon un cadre `rounded-[20px] border-4 border-dashed border-[#f4ebdd]/25 px-10 py-6 text-[56px] opacity-50` contenant « ? » et, en `sr-only`, `fr('authorsHidden')` ; puis le rang moyen (`fr('avgRank', …)` / `en('avgRank', …)`, format `fr-CA` existant) ; puis, si `step.podium && gap > 0`, `<Bi k="ptsAhead" v={{ n: gap, k: ordinal(…) }} …/>` — attention : `k` diffère selon la langue, donc rendre deux lignes à la main : `fr('ptsAhead', { n: gap, k: ordinal('fr', nextRow.position) })` et `en('ptsAhead', { n: gap, k: ordinal('en', nextRow.position) })`.
    - Pour que le texte « Auteurs à venir » soit trouvable par le test, le placer en `sr-only` (le test utilise `findByText`, qui voit le texte `sr-only`).
    - Le halo du 1er : `style={{ background: 'radial-gradient(circle at 50% 45%, #5a4126, #1f170f 78%)' }}` quand `step.position === 1`.
  - Final : `<Bi k="finalRanking" className="font-display text-[56px]" />`, `<Podium rows={rows} size="tv" text={fr} lang="fr" />`, puis la liste `podium(rows).rest` sur deux colonnes (`flex flex-wrap` et non `grid` n'est pas requis ici — la scène est du DOM, pas Satori, `grid` est permis) : chaque ligne `rounded-[18px] bg-[#fffdf9]/10 px-6 py-3 text-[26px]` avec `ordinal('fr', r.position)` ou `fr('unranked')`, `fr('plateTag', …)`, auteurs en `#7f98e0`, note.
  - Supprimer la constante `formatAvgRank` si elle n'est plus utilisée, sinon la garder.

- [ ] **Step 6 :** `npx vitest run` → PASS (suite complète) ; `npx tsc --noEmit` ; `npm run lint`.

- [ ] **Step 7 : commit** — `feat(concours): scène bilingue (halo, étiquettes, rang géant) et podium en pyramide`

---

### Task 12 : Vérification de bout en bout et finitions

**Files:** aucun nouveau (corrections éventuelles dans les fichiers déjà touchés).

- [ ] **Step 1 :** `npm test`, `npx tsc --noEmit`, `npm run lint` → tout vert. Noter les chiffres (nombre de tests).
- [ ] **Step 2 :** `npm run dev` en arrière-plan. Avec Playwright (MCP) :
  1. `/admin` (mot de passe quelconque en dev ; l'encart « contournement » du formulaire doit apparaître, sinon s'arrêter), créer un concours « Test PR2 », le renommer « Test PR 2 » via le crayon, revenir à la liste par « ‹ Tous les concours » puis y retourner.
  2. Ajouter 3 invités (Camille, Hugo, Inès) et 3 assiettes (auteurs : Camille ; Hugo ; aucun), éditer une assiette dans sa carte (note « vegan »).
  3. Vérifier les couleurs : frise + liseré + numéros changent à chaque phase ; captures en thème sombre et clair.
  4. Bloc Accès invités : l'aperçu PNG s'affiche ; « PNG carte » et « PNG QR seul » téléchargent ; « Copier le lien » affiche « Copié ».
  5. Deux contextes navigateur « téléphone » (viewport 390×844) sur l'URL invité : langue FR pour l'un, EN pour l'autre ; Camille et Hugo réclament leur nom ; ouvrir les votes ; Camille classe ; Camille « Changer de nom » → la feuille avertit, confirmer → retour à « Qui es-tu ? », Camille rechoisit Camille → classement vide ; classer de nouveau.
  6. Clore : les téléphones affichent « Votes clos » / « Voting closed » ; passer en Révélation : « Révélation en cours ».
  7. Ouvrir la scène (1920×1080), parcourir toutes les étapes à la flèche droite : titre bilingue, rangs en deux temps, 1er avec halo et écart, écran final en pyramide + liste. Captures de chaque type d'étape.
  8. Les téléphones basculent sur le récapitulatif avec la pyramide en tête.
  9. Supprimer le concours de test.
- [ ] **Step 3 :** montrer les captures à Léo (scène, pilotage sombre/clair, téléphones, PNG carte) et corriger ses retours dans des commits `fix(concours): …`.
- [ ] **Step 4 :** vérifier que la branche ne contient que ce travail (`git log --oneline main..HEAD`, cf. sessions parallèles), puis proposer à Léo de pousser et d'ouvrir la PR (`superpowers:finishing-a-development-branch`). **Ne pas pousser sans son accord.**
