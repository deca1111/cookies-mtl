'use client'

import { useState } from 'react'
import { setRevealStepAction } from '@/app/actions/contest-admin'
import type { AdminView } from '@/lib/contest-state'
import { ContestQr } from './ContestQr'
import { runAction, UNEXPECTED_ERROR } from './runAction'

const ERR: Record<string, string> = {
  locked: 'La révélation n’est plus en cours.',
  'not-found': 'Concours introuvable — il a peut-être été supprimé.',
  stale: 'La phase a déjà changé.',
  step: 'Étape invalide.',
  unexpected: UNEXPECTED_ERROR,
}

export function PilotPanel({ view, onDone }: { view: AdminView; onDone: () => void }) {
  const { contest, rows, steps } = view
  const [showLive, setShowLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Un double clic sur une flèche de révélation avant que le premier n'ait
  // fini son aller-retour ferait sauter une étape : les actions serveur sont
  // sérialisées, rien côté écran ne les espaçait (finding #1). `busy` couvre
  // le pas de révélation — un seul geste de pilotage à la fois.
  const [busy, setBusy] = useState(false)
  const btn = 'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] px-3 py-1.5 text-[13px] text-[color:var(--text-body)] disabled:opacity-40'

  const step = async (s: number) => {
    if (busy) return
    setBusy(true)
    const res = await runAction(setRevealStepAction(contest.id, s))
    setError(res.ok ? null : (ERR[res.error] ?? 'Erreur.'))
    setBusy(false)
    onDone()
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">Pilotage</h2>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}

      {contest.phase === 'reveal' && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-3">
          <p className="text-[13px] text-[color:var(--text-muted)]">Révélation : étape {contest.revealStep + 1}/{steps.length}</p>
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={busy || contest.revealStep === 0} onClick={() => step(contest.revealStep - 1)}>← Précédente</button>
            <button type="button" className={btn} disabled={busy || contest.revealStep >= steps.length - 1} onClick={() => step(contest.revealStep + 1)}>Suivante →</button>
          </div>
        </div>
      )}
      <a href={`/admin/concours/${contest.id}/scene`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[color:var(--accent-ink)] underline">
        Ouvrir la scène
      </a>

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
