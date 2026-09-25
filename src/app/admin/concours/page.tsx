import { Suspense } from 'react'
import { ContestList } from '@/components/admin/contest/ContestList'
import { LoginForm } from '@/components/admin/LoginForm'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { listContests } from '@/lib/contest-db'

export const metadata = { title: 'Concours — Admin', robots: { index: false, follow: false } }

export default function ContestsPage() {
  return (
    <Suspense fallback={<main className="p-6">Chargement…</main>}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  return <ContestList contests={await listContests()} />
}
