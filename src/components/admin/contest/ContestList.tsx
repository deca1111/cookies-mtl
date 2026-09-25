'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createContestAction, deleteContestAction } from '@/app/actions/contest-admin'
import type { ContestSummary } from '@/lib/contest-db'

export const PHASE_LABEL = { preparation: 'Préparation', voting: 'Votes ouverts', closed: 'Votes clos', reveal: 'Révélation' } as const

const field = 'rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] text-[color:var(--text-strong)]'
const primary = 'rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-4 py-2 text-[14px] font-medium text-[color:var(--btn-text)] hover:bg-[color:var(--btn-bg-hover)] disabled:opacity-50'

export function ContestList({ contests }: { contests: ContestSummary[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [typed, setTyped] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const res = await createContestAction(name)
    if (res.ok) router.push(`/admin/concours/${res.id}`)
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">Concours</h1>
        <a href="/admin" className="text-[13px] text-[color:var(--text-muted)] underline">Retour à l’admin</a>
      </div>
      <form onSubmit={create} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du concours" className={`${field} flex-1`} />
        <button disabled={!name.trim()} className={primary}>Créer</button>
      </form>
      <ul className="flex flex-col gap-2">
        {contests.map((c) => (
          <li key={c.id} className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="flex items-center gap-4">
              <a href={`/admin/concours/${c.id}`} className="flex-1 text-[16px] font-medium text-[color:var(--text-strong)] hover:underline">{c.name}</a>
              <span className="text-[13px] text-[color:var(--text-muted)]">
                {PHASE_LABEL[c.phase]} · {c.guestCount} invités · {new Date(c.createdAt).toLocaleDateString('fr-CA')}
              </span>
              <button type="button" onClick={() => { setDeleting(c.id); setTyped('') }} className="text-[13px] text-[color:var(--danger)]">
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
                    disabled={typed !== c.name}
                    onClick={async () => {
                      await deleteContestAction(c.id)
                      setDeleting(null)
                      router.refresh()
                    }}
                    className="rounded-[var(--radius-field)] bg-[color:var(--danger)] px-4 py-2 text-[14px] text-white disabled:opacity-40"
                  >
                    Supprimer définitivement
                  </button>
                  <button type="button" onClick={() => setDeleting(null)} className="text-[13px] text-[color:var(--text-muted)]">Annuler</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
