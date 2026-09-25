'use client'

import { useState } from 'react'
import { addGuestAction, deleteGuestAction, releaseGuestAction, renameGuestAction } from '@/app/actions/contest-admin'
import type { AdminGuest } from '@/lib/contest-state'
import { runAction, UNEXPECTED_ERROR } from './runAction'
import { useConfirmDelete } from './useConfirmDelete'

const ERR: Record<string, string> = { name: 'Nom vide ou trop long (40 max).', 'name-taken': 'Ce nom existe déjà.', unexpected: UNEXPECTED_ERROR }

export function GuestPanel({ contestId, guests, onDone }: { contestId: number; guests: AdminGuest[]; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)
  // Un double clic/double Entrée avant que le premier ajout ne soit retombé
  // ajouterait le même invité deux fois d'affilée (finding #1).
  const [adding, setAdding] = useState(false)
  const { armed, press } = useConfirmDelete<number>()

  // `runAction` capture aussi bien { ok: false } qu'une levée (session expirée,
  // réseau) : onDone est toujours rappelé pour relire l'état réel du serveur.
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const res = await runAction(p)
    setError(res.ok ? null : (ERR[res.error ?? ''] ?? 'Erreur.'))
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
          if (adding) return
          setAdding(true)
          const ok = await run(addGuestAction(contestId, name))
          setAdding(false)
          if (ok) setName('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un invité puis Entrée"
          disabled={adding}
          className="w-full rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] disabled:opacity-50"
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
            <button
              type="button"
              onClick={() => press(g.id, () => run(deleteGuestAction(contestId, g.id)))}
              className="text-[12px] text-[color:var(--danger)]"
            >
              {armed === g.id ? 'Confirmer ?' : 'Suppr.'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
