'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="font-display text-[26px] leading-tight text-[color:var(--text-strong)]">🍪 Admin Cookies MTL</h1>
      <form
        action={action}
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-chip)]"
      >
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          autoFocus
          className="rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] px-4 py-3 text-[15px] text-[color:var(--text-strong)] placeholder:text-[color:var(--text-muted)]"
        />
        <button
          disabled={pending}
          className="rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-4 py-3 text-[15px] font-medium text-[color:var(--btn-text)] transition-colors hover:bg-[color:var(--btn-bg-hover)] disabled:opacity-60"
        >
          {pending ? '…' : 'Entrer'}
        </button>
        {state?.error && <p className="text-[13px] text-[color:var(--danger)]">Mot de passe incorrect.</p>}
      </form>
    </main>
  )
}
