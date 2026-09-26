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
