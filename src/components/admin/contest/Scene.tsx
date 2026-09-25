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
    // `force: true` — au clavier, chaque appui doit avancer la scène tout de
    // suite ; sans lui, un sondage déjà en vol (toutes les 1,5 s ici) pourrait
    // absorber la relecture et retarder l'étape suivante jusqu'au prochain tour.
    const go = async (s: number) => {
      await setRevealStepAction(contest.id, s)
      await refresh(true)
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
