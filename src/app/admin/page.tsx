import { Suspense } from 'react'
import { isAdmin } from '@/lib/auth'
import { listShops } from '@/lib/shops'
import { AdminApp } from '@/components/admin/AdminApp'
import { LoginForm } from '@/components/admin/LoginForm'

export const metadata = { title: 'Admin — Cookies Club', robots: { index: false, follow: false } }

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="p-6">Chargement…</main>}>
      <AdminGate />
    </Suspense>
  )
}

async function AdminGate() {
  if (!(await isAdmin())) return <LoginForm />
  const shops = await listShops()
  return <AdminApp shops={shops} />
}
