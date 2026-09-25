import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ContestControl } from '@/components/admin/contest/ContestControl'
import { LoginForm } from '@/components/admin/LoginForm'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { parseContestId } from '@/lib/contest-rules'
import { loadAdminView } from '@/lib/contest-views'

export const metadata = { title: 'Pilotage — Concours', robots: { index: false, follow: false } }

export default function ContestControlPage({ params }: PageProps<'/admin/concours/[id]'>) {
  return (
    <Suspense fallback={<main className="p-6">Chargement…</main>}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({ params }: { params: PageProps<'/admin/concours/[id]'>['params'] }) {
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  const id = parseContestId((await params).id)
  const view = id === null ? null : await loadAdminView(id)
  if (!view) notFound()
  return <ContestControl initial={view} />
}
