// Enveloppe commune à toutes les actions serveur du pilotage admin : une action
// peut échouer proprement ({ ok: false, error }) OU lever (session admin expirée
// → requireAdmin lève, coupure réseau, erreur Neon…). Sans ce filet, une levée
// devient une "unhandled promise rejection" invisible côté écran, et l'état
// n'est jamais relu (onDone n'est pas rappelé). `runAction` uniformise les deux
// cas : la levée est capturée et transformée en { ok: false, error: 'unexpected' },
// pour que chaque appelant puisse toujours écrire `const res = await runAction(...)`
// puis afficher `res.error` et relire l'état, sans jamais avoir à écrire de try/catch.
export const UNEXPECTED_ERROR = 'Action impossible — vérifie ta connexion ou reconnecte-toi.'

export async function runAction<T extends { ok: boolean }>(
  promise: Promise<T>,
): Promise<T | { ok: false; error: 'unexpected' }> {
  try {
    return await promise
  } catch {
    return { ok: false, error: 'unexpected' }
  }
}
