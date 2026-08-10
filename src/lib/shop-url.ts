// Synchro URL ↔ cookie sélectionné (v1.2.2) : la sélection sur la carte pousse
// /c/[slug] dans l'historique (pushState natif, intégré au routeur Next) sans
// recharger la carte. Double gain : un refresh ou un partage retombe sur la
// bonne fiche (la route /c/[slug] existe déjà côté serveur), et chaque sélection
// compte comme une page vue dans Vercel Analytics — stats par cookie sur Hobby.

export function shopPath(slug: string | null): string {
  return slug ? `/c/${encodeURIComponent(slug)}` : '/'
}

export function slugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/c\/([^/]+)\/?$/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}
