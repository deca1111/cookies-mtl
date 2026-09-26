'use client'

import { useState } from 'react'
import type { ContestMsgKey } from '@/lib/contest-i18n'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

// Feuille par le bas (spec PR 2 §5). Prévient franchement que le classement
// sera effacé : c'est le seul geste destructif côté invité.
export function ChangeNameSheet({ name, t, onConfirm, onClose }: {
  name: string; t: T; onConfirm: () => Promise<boolean>; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="change-name-title" className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-[var(--radius-sheet)] bg-[color:var(--surface)] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <h2 id="change-name-title" className="font-display text-[22px] text-[color:var(--text-strong)]">{t('notYou', { name })}</h2>
        <p className="text-[15px] text-[color:var(--text-body)]">{t('changeNameBody', { name })}</p>
        {failed && <p className="text-[14px] text-[color:var(--danger)]">{t('changeNameFailed')}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await onConfirm()
            setBusy(false)
            setFailed(!ok)
          }}
          className="rounded-[var(--radius-card)] bg-[color:var(--btn-bg)] px-6 py-4 text-[17px] font-medium text-[color:var(--btn-text)] disabled:opacity-60"
        >
          {t('changeNameConfirm')}
        </button>
        <button type="button" onClick={onClose} className="text-[15px] text-[color:var(--text-muted)] underline">{t('cancel')}</button>
      </div>
    </div>
  )
}
