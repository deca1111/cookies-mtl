'use client'

import Link from 'next/link'
import { useState } from 'react'
import { renameContestAction } from '@/app/actions/contest-admin'
import { IconChevronLeft, IconPencil } from '@/components/icons'
import { runAction, UNEXPECTED_ERROR } from './runAction'

const ERR: Record<string, string> = {
  name: 'Nom vide ou trop long (40 max).',
  'not-found': 'Concours introuvable — il a peut-être été supprimé.',
  unexpected: UNEXPECTED_ERROR,
}

// En-tête du pilotage (spec PR 2 §2) : retour propre vers la liste et nom
// renommable sur place. Échap ou perte de focus abandonnent la saisie.
export function ContestHeader({ contestId, name, onDone }: { contestId: number; name: string; onDone: () => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (draft === null || saving) return
    setSaving(true)
    const res = await runAction(renameContestAction(contestId, draft))
    setSaving(false)
    if (res.ok) {
      setDraft(null)
      setError(null)
    } else setError(ERR[res.error] ?? 'Erreur.')
    onDone()
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/concours"
          className="flex items-center gap-1 rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[13px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)]"
        >
          <IconChevronLeft size={14} />
          Tous les concours
        </Link>
        {draft === null ? (
          <>
            <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{name}</h1>
            <button
              type="button"
              aria-label="Renommer le concours"
              onClick={() => { setDraft(name); setError(null) }}
              className="rounded-[var(--radius-field)] border border-[color:var(--border)] p-1.5 text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]"
            >
              <IconPencil size={14} />
            </button>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void save() }}>
            <input
              autoFocus
              aria-label="Nom du concours"
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(null); setError(null) } }}
              onBlur={() => { if (!saving && !error) setDraft(null) }}
              className="font-display rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-2 py-1 text-[22px] text-[color:var(--text-strong)]"
            />
          </form>
        )}
      </div>
      {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}
    </div>
  )
}
