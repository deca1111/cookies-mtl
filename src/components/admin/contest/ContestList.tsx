'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createContestAction, deleteContestAction } from '@/app/actions/contest-admin'
import type { ContestSummary } from '@/lib/contest-db'
import { PHASE_LABEL } from './phase-label'
import { phaseColorVar } from './phase-style'
import { runAction, UNEXPECTED_ERROR } from './runAction'

const ERR: Record<string, string> = { name: 'Nom vide ou trop long (40 max).', unexpected: UNEXPECTED_ERROR }

const field = 'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] text-[color:var(--text-strong)]'
const primary = 'rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-4 py-2 text-[14px] font-medium text-[color:var(--btn-text)] hover:bg-[color:var(--btn-bg-hover)] disabled:opacity-50'

export function ContestList({ contests }: { contests: ContestSummary[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    // Ceinture et bretelles : un bouton `disabled` bloque déjà la soumission
    // implicite par Entrée (le navigateur écarte un bouton désactivé de la
    // recherche du bouton par défaut du formulaire). Ce garde ne protège donc
    // qu'un scénario improbable (balisage futur, double appel avant que React
    // n'ait repeint l'état pending) — peu coûteux à garder.
    if (pending) return
    setPending(true)
    const res = await runAction(createContestAction(name))
    if (res.ok) {
      router.push(`/admin/concours/${res.id}`)
      return
    }
    setCreateError(ERR[res.error] ?? UNEXPECTED_ERROR)
    setPending(false)
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">Concours</h1>
        <a href="/admin" className="text-[13px] text-[color:var(--text-muted)] underline">Retour à l’admin</a>
      </div>
      <form onSubmit={create} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du concours" className={`${field} flex-1`} />
          <button disabled={!name.trim() || pending} className={primary}>Créer</button>
        </div>
        {createError && <p className="text-[13px] text-[color:var(--danger)]">{createError}</p>}
      </form>
      <ul className="flex flex-col gap-2">
        {contests.map((c) => (
          <li key={c.id} className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="flex items-center gap-4">
              <a href={`/admin/concours/${c.id}`} className="flex-1 text-[16px] font-medium text-[color:var(--text-strong)] hover:underline">{c.name}</a>
              <span className="text-[13px] text-[color:var(--text-muted)]">
                <span className="font-medium" style={{ color: phaseColorVar(c.phase) }}>{PHASE_LABEL[c.phase]}</span>
                {' '}· {c.guestCount} invités · {new Date(c.createdAt).toLocaleDateString('fr-CA')}
              </span>
              <button
                type="button"
                onClick={() => { setDeleting(c.id); setTyped(''); setDeleteError(null) }}
                className="text-[13px] text-[color:var(--danger)]"
              >
                Supprimer
              </button>
            </div>
            {deleting === c.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3">
                <p className="text-[13px] text-[color:var(--text-body)]">
                  Irréversible : invités, assiettes et votes seront effacés, le QR code ne mènera plus nulle part. Retape le nom pour confirmer.
                </p>
                <div className="flex gap-2">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={c.name} className={`${field} flex-1`} />
                  <button
                    type="button"
                    disabled={typed !== c.name || deleteBusy}
                    onClick={async () => {
                      if (deleteBusy) return
                      setDeleteBusy(true)
                      const res = await runAction(deleteContestAction(c.id))
                      setDeleteBusy(false)
                      // Toujours resynchroniser la liste, échec compris : la
                      // tentative peut avoir partiellement abouti côté serveur,
                      // et de toute façon la liste doit refléter l'état réel.
                      router.refresh()
                      if (res.ok) {
                        setDeleting(null)
                      } else {
                        setDeleteError(ERR[res.error] ?? UNEXPECTED_ERROR)
                      }
                    }}
                    className="rounded-[var(--radius-field)] bg-[color:var(--danger)] px-4 py-2 text-[14px] text-white disabled:opacity-40"
                  >
                    Supprimer définitivement
                  </button>
                  <button type="button" onClick={() => setDeleting(null)} className="text-[13px] text-[color:var(--text-muted)]">Annuler</button>
                </div>
                {deleteError && <p className="text-[13px] text-[color:var(--danger)]">{deleteError}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
