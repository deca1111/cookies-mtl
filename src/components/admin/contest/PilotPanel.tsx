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
