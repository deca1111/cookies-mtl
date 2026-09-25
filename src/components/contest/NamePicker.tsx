'use client'

import { useState } from 'react'
import type { ContestMsgKey } from '@/lib/contest-i18n'
import type { GuestView } from '@/lib/contest-state'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

export function NamePicker({ guests, onClaim, t, notice }: {
  // `onClaim` renvoie si la réclamation a abouti : sur un échec, on reste sur
  // l'écran de confirmation (le bandeau d'erreur l'explique) plutôt que de
  // renvoyer la personne choisir un nom au hasard dans la liste.
  guests: GuestView['guests']; onClaim: (id: number) => Promise<boolean>; t: T; notice: string | null
}) {
  const [pending, setPending] = useState<{ id: number; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const noticeEl = notice && (
    <p className="rounded-[var(--radius-field)] bg-[color:var(--accent-wash)] p-3 text-[14px] text-[color:var(--text-body)]">{notice}</p>
  )

  if (pending) {
    return (
      <div className="flex flex-col gap-4 pt-10">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{t('confirmName', { name: pending.name })}</h1>
        {noticeEl}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              // Un échec (nom déjà pris, réseau) laisse `pending` en place : le
              // bandeau d'erreur apparaît et le bouton redevient utilisable pour
              // réessayer, sans repasser par la liste.
              if (await onClaim(pending.id)) setPending(null)
            } finally {
              setBusy(false)
            }
          }}
          className="rounded-[var(--radius-card)] bg-[color:var(--btn-bg)] px-6 py-4 text-[18px] font-medium text-[color:var(--btn-text)] disabled:opacity-60"
        >
          {t('confirm')}
        </button>
        <button type="button" onClick={() => setPending(null)} className="text-[15px] text-[color:var(--text-muted)] underline">
          {t('cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pt-6">
      <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('whoAreYou')}</h1>
      <p className="text-[14px] text-[color:var(--text-muted)]">{t('whoHint')}</p>
      {noticeEl}
      <ul className="flex flex-col gap-2">
        {guests.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              disabled={g.taken}
              onClick={() => setPending({ id: g.id, name: g.name })}
              className="flex w-full flex-col items-start rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-left text-[17px] text-[color:var(--text-strong)] disabled:opacity-50"
            >
              {g.name}
              {g.taken && <span className="text-[12px] text-[color:var(--text-muted)]">{t('takenHint')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
