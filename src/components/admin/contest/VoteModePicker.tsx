'use client'

import { useState } from 'react'
import { setTopKAction } from '@/app/actions/contest-admin'
import { TOP_K_MAX, type Phase } from '@/lib/contest-rules'
import { runAction, UNEXPECTED_ERROR } from './runAction'

const ERR: Record<string, string> = {
  locked: 'Mode de vote figé depuis la clôture des votes.',
  'not-found': 'Concours introuvable — il a peut-être été supprimé.',
  'top-k': 'Mode de vote invalide.',
  unexpected: UNEXPECTED_ERROR,
}

// X proposé en passant de « Tout » à « Top X » : la bonne échelle pour une
// vingtaine de cookies.
const DEFAULT_K = 5

// Deux modes (retours d'UAT) : « Top X », où seuls les X premiers de chaque
// invité rapportent des points (X au 1er, puis un de moins par place), et
// « Tout », où chacun classe tous les cookies. X se règle au − / +. Réglable
// jusqu'à la clôture des votes (les bulletins gardent l'ordre complet).
export function VoteModePicker({ contestId, phase, topK, onDone }: { contestId: number; phase: Phase; topK: number | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Dernier X choisi, pour le retrouver en revenant de « Tout ».
  const [lastK, setLastK] = useState(topK ?? DEFAULT_K)
  const editable = phase === 'preparation' || phase === 'voting'

  const choose = async (k: number | null) => {
    if (busy || k === topK) return
    if (k !== null) setLastK(k)
    setBusy(true)
    const res = await runAction(setTopKAction(contestId, k))
    setError(res.ok ? null : (ERR[res.error] ?? 'Erreur.'))
    setBusy(false)
    onDone()
  }

  const seg = (on: boolean) => `px-3 py-1 ${on ? 'bg-[color:var(--btn-bg)] text-[color:var(--btn-text)]' : 'text-[color:var(--text-body)]'}`
  const step = 'h-7 w-7 rounded-full border border-[color:var(--border-strong)] text-[15px] leading-none text-[color:var(--text-body)] disabled:opacity-30'

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
      <span className="text-[color:var(--text-muted)]">Mode de vote</span>
      <div role="group" aria-label="Mode de vote" className="flex overflow-hidden rounded-full border border-[color:var(--border-strong)]">
        <button type="button" aria-pressed={topK !== null} disabled={busy || !editable} onClick={() => choose(lastK)} className={seg(topK !== null)}>
          Top {topK ?? lastK}
        </button>
        <button type="button" aria-pressed={topK === null} disabled={busy || !editable} onClick={() => choose(null)} className={seg(topK === null)}>
          Tout
        </button>
      </div>
      {topK !== null && editable && (
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Un cookie de moins dans le top" disabled={busy || topK <= 1} onClick={() => choose(topK - 1)} className={step}>−</button>
          <span className="font-display w-6 text-center text-[16px] text-[color:var(--text-strong)]">{topK}</span>
          <button type="button" aria-label="Un cookie de plus dans le top" disabled={busy || topK >= TOP_K_MAX} onClick={() => choose(topK + 1)} className={step}>+</button>
        </div>
      )}
      <span className="text-[color:var(--text-muted)]">
        {topK === null
          ? 'Chacun classe tous les cookies ; tous rapportent des points.'
          : `${topK} pt${topK > 1 ? 's' : ''} au 1er de chaque invité, puis un de moins par place ; au-delà du ${topK === 1 ? '1er' : `${topK}e`}, rien.`}
        {!editable && ' Figé depuis la clôture des votes.'}
      </span>
      {error && <p className="w-full text-[color:var(--danger)]">{error}</p>}
    </section>
  )
}
