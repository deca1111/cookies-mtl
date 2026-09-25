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
    setError(res.ok ? null : (ERR[res.error] ?? 'Erreur.'))
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
          <button
            type="button"
            onClick={async () => {
              const r = await shufflePlatesAction(contestId)
              setError(r.ok ? null : (ERR[r.error] ?? 'Erreur.'))
              onDone()
            }}
            className="text-[13px] text-[color:var(--accent-ink)]"
          >
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
