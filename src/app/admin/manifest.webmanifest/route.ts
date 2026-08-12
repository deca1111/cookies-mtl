import { adminManifest } from '@/lib/admin-manifest'

// Route handler plutôt que fichier `manifest.ts` : la convention de fichier Next
// n'est reconnue qu'à la racine d'`app/`, jamais dans un sous-dossier. Celui de la
// racine reste donc la PWA publique, et l'admin sert le sien ici.
export function GET() {
  return Response.json(adminManifest(), {
    headers: { 'content-type': 'application/manifest+json' },
  })
}
