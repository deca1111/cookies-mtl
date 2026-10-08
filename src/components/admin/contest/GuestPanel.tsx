'use client'

import { useState } from 'react'
import { addGuestAction, deleteGuestAction, releaseAllGuestsAction, releaseGuestAction, renameGuestAction } from '@/app/actions/contest-admin'
import { IconCheck, IconEye, IconEyeOff } from '@/components/icons'
import type { AdminGuest } from '@/lib/contest-state'
import type { Phase } from '@/lib/contest-rules'
import { runAction, UNEXPECTED_ERROR } from './runAction'
import { useConfirmDelete } from './useConfirmDelete'
import { guestState, STATE_BADGE } from './guest-state'

const ERR: Record<string, string> = { name: 'Nom vide ou trop long (40 max).', 'name-taken': 'Ce nom existe déjà.', locked: 'Votes clos : les noms ne se libèrent plus.', unexpected: UNEXPECTED_ERROR }

export function GuestPanel({ contestId, phase, guests, onDone }: { contestId: number; phase: Phase; guests: AdminGuest[]; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)
  // Un double clic/double Entrée avant que le premier ajout ne soit retombé
  // ajouterait le même invité deux fois d'affilée (finding #1).
  const [adding, setAdding] = useState(false)
  // Un seul armement pour toute la liste : « Suppr. » et « Libérer » (qui efface
  // le classement) se confirment chacun par un second clic, sans s'armer l'un l'autre.
  const { armed, press } = useConfirmDelete<string>()
  // Après la clôture, le bulletin qui partirait avec le nom est déjà compté.
  const canRelease = phase === 'preparation' || phase === 'voting'
  // Classement d'un invité, déplié à la demande : fermé par défaut pour ne pas
  // se spoiler en tant que participant.
  const [shown, setShown] = useState<number | null>(null)

  // `runAction` capture aussi bien { ok: false } qu'une levée (session expirée,
  // réseau) : onDone est toujours rappelé pour relire l'état réel du serveur.
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const res = await runAction(p)
    setError(res.ok ? null : (ERR[res.error ?? ''] ?? 'Erreur.'))
    onDone()
    return res.ok
  }

  // Avancement vers son top K (ou vers tout, en mode « tout ») : au-delà, les
  // cookies classés ne rapportent rien, inutile de les compter ici.
  const status = (g: AdminGuest) =>
    !g.claimed ? 'libre' : g.target === 0 ? 'connecté' : `${Math.min(g.ranked, g.target)}/${g.target} classés`

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b-2 border-[color:var(--border)] pb-2">
        <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">Invités</h2>
        <span className="text-[13px] text-[color:var(--text-muted)]">{guests.length}</span>
        {canRelease && guests.some((g) => g.claimed) && (
          <button
            type="button"
            onClick={() => press('tous', () => run(releaseAllGuestsAction(contestId)))}
            className="ml-auto text-[12px] text-[color:var(--accent-ink)]"
          >
            {armed === 'tous' ? 'Confirmer : noms libérés, classements effacés' : 'Déconnecter tous les téléphones'}
          </button>
        )}
      </div>
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
          <li key={g.id} className="flex flex-col gap-1 rounded-[var(--radius-field)] px-2 py-1.5 hover:bg-[color:var(--surface-2)]">
            <div className="flex items-center gap-2">
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
              <span data-state={guestState(g)} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${STATE_BADGE[guestState(g)]}`}>
                {guestState(g) === 'complete' && <IconCheck size={11} />}
                {status(g)}
              </span>
              {g.ranked > 0 && (
                <button
                  type="button"
                  aria-label={`${shown === g.id ? 'Masquer' : 'Voir'} le classement de ${g.name}`}
                  aria-pressed={shown === g.id}
                  onClick={() => setShown(shown === g.id ? null : g.id)}
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]"
                >
                  {shown === g.id ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                </button>
              )}
              {g.claimed && canRelease && (
                <button
                  type="button"
                  onClick={() => press(`liberer-${g.id}`, () => run(releaseGuestAction(contestId, g.id)))}
                  className="text-[12px] text-[color:var(--accent-ink)]"
                >
                  {armed === `liberer-${g.id}` ? 'Confirmer ?' : 'Libérer'}
                </button>
              )}
              <button
                type="button"
                onClick={() => press(`suppr-${g.id}`, () => run(deleteGuestAction(contestId, g.id)))}
                className="text-[12px] text-[color:var(--danger)]"
              >
                {armed === `suppr-${g.id}` ? 'Confirmer ?' : 'Suppr.'}
              </button>
            </div>
            {shown === g.id && (
              <ol className="flex flex-wrap gap-x-3 gap-y-1 pb-1 text-[13px] text-[color:var(--text-body)]">
                {g.ballot.map((n, i) => (
                  <li key={n} className="flex items-baseline gap-1">
                    <span className="text-[11px] text-[color:var(--text-muted)]">{i + 1}</span>
                    <span>N° {n}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
