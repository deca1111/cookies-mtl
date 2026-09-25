import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LoginForm } from '@/components/admin/LoginForm'
import { Scene } from '@/components/admin/contest/Scene'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { parseContestId } from '@/lib/contest-rules'
import { loadAdminView } from '@/lib/contest-views'

export const metadata = { title: 'Scène — Concours', robots: { index: false, follow: false } }

export default function ScenePage({ params }: PageProps<'/admin/concours/[id]/scene'>) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[color:var(--bg)]" />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({ params }: { params: PageProps<'/admin/concours/[id]/scene'>['params'] }) {
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  const id = parseContestId((await params).id)
  const view = id === null ? null : await loadAdminView(id)
  if (!view) notFound()
  return <Scene initial={view} />
}
