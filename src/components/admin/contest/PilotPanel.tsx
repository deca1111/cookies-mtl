'use client'

import { useState } from 'react'
import { setRevealStepAction } from '@/app/actions/contest-admin'
import type { AdminView } from '@/lib/contest-state'
import { IconEye, IconEyeOff, IconExternal, IconRefresh } from '@/components/icons'
import { AccessPanel } from './AccessPanel'
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
          {/* Recalculé à chaque relecture de l'état (toutes les 2,5 s) : ce bouton
              la déclenche tout de suite. */}
          <button type="button" aria-label="Rafraîchir le classement" onClick={onDone} className={`${btn} mr-1.5`}>
            <IconRefresh size={14} />
          </button>
          <button type="button" aria-label={showLive ? 'Masquer le classement en direct' : 'Afficher le classement en direct'} aria-pressed={showLive}
            onClick={() => setShowLive(!showLive)} className={btn}>
            {showLive ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
        </div>
        {showLive ? (
          <ol className="flex flex-col gap-1 text-[13px] text-[color:var(--text-body)]">
            {rows.map((r) => (
              <li key={r.plateId}>{r.position ?? '—'}. Cookie {r.number} — {r.score ?? 0} pts ({r.votes} voix) {r.authors.join(' & ')}</li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-[color:var(--text-muted)]">Masqué. Clique sur l’œil pour l’afficher.</p>
        )}
      </div>
    </section>
  )
}
