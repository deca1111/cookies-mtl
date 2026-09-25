import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ContestGuestApp } from '@/components/contest/ContestGuestApp'
import { loadGuestView } from '@/lib/contest-views'

export const metadata: Metadata = { title: 'Concours — Cookies Club', robots: { index: false, follow: false } }

export default function ContestGuestPage({ params }: PageProps<'/concours/[secret]'>) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[color:var(--bg)]" />}>
      <Guest params={params} />
    </Suspense>
  )
}

async function Guest({ params }: { params: PageProps<'/concours/[secret]'>['params'] }) {
  const { secret } = await params
  const view = await loadGuestView(secret)
  // Secret faux ou concours supprimé : 404 nu, rien qui confirme qu'un concours a existé.
  if (!view) notFound()
  return <ContestGuestApp secret={secret} initial={view} />
}
