'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="font-serif text-2xl">🍪 Admin Cookies MTL</h1>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          autoFocus
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--sheet-bg)] px-4 py-3"
        />
        <button disabled={pending} className="rounded-xl bg-[color:var(--btn-bg)] px-4 py-3 text-[color:var(--btn-text)]">
          {pending ? '…' : 'Entrer'}
        </button>
        {state?.error && <p className="text-sm text-red-600">Mot de passe incorrect.</p>}
      </form>
    </main>
  )
}
