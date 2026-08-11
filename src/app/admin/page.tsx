import { Suspense } from 'react'
import { isAdmin, isDevPasswordBypass } from '@/lib/auth'
import { listAllShops } from '@/lib/shops'
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
  // L'indice du formulaire vient du serveur, du MÊME prédicat que la vérification
  // du mot de passe : pas de second test côté client qui pourrait diverger.
  if (!(await isAdmin())) return <LoginForm devBypass={isDevPasswordBypass()} />
  // listAllShops (et pas listShops) : l'admin est le seul endroit qui voit les
  // fiches « en cours ».
  const shops = await listAllShops()
  return <AdminApp shops={shops} />
}
