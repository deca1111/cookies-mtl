import type { AdminGuest } from '@/lib/contest-state'

// Où en est un invité, vu de la régie (retours d'UAT : voir d'un coup d'œil si
// tout le monde a fini). Une seule règle pour la pastille de chaque invité et
// pour le résumé sous la frise, pour qu'ils ne puissent pas se contredire.
// - free : nom pas encore pris sur un téléphone ;
// - idle : connecté, mais rien à classer (auteur de tous les cookies) ;
// - empty : connecté, rien classé ;
// - partial : a commencé, top (ou classement complet en mode « tout ») pas rempli ;
// - complete : top rempli — ce qu'il classe au-delà ne change rien aux points.
export type GuestState = 'free' | 'idle' | 'empty' | 'partial' | 'complete'

export function guestState(g: AdminGuest): GuestState {
  if (!g.claimed) return 'free'
  if (g.target === 0) return 'idle'
  if (g.ranked === 0) return 'empty'
  return g.ranked >= g.target ? 'complete' : 'partial'
}

// Couleurs de la pastille : vert de la phase de vote pour « complet », caramel
// pour « en cours », neutre sinon. Mêmes teintes pour les puces du résumé.
export const STATE_BADGE: Record<GuestState, string> = {
  free: 'border border-[color:var(--border)] text-[color:var(--text-muted)]',
  idle: 'border border-[color:var(--border-strong)] text-[color:var(--text-body)]',
  empty: 'bg-[color:var(--surface-2)] text-[color:var(--text-muted)]',
  partial: 'bg-[color:var(--accent-wash)] text-[color:var(--accent-ink)]',
  complete: 'bg-[color-mix(in_srgb,var(--phase-voting)_20%,transparent)] font-bold text-[color:var(--phase-voting)]',
}

export const STATE_DOT: Record<GuestState, string> = {
  free: 'border border-[color:var(--border-strong)]',
  idle: 'border border-[color:var(--text-body)]',
  empty: 'bg-[color:var(--text-muted)]',
  partial: 'bg-[color:var(--accent)]',
  complete: 'bg-[color:var(--phase-voting)]',
}

// Résumé sous la frise, du plus avancé au moins avancé ; les états vides sont omis.
const SUMMARY: [GuestState, (n: number) => string][] = [
  ['complete', (n) => `${n} complet${n > 1 ? 's' : ''}`],
  ['partial', (n) => `${n} en cours`],
  ['empty', (n) => `${n} pas commencé${n > 1 ? 's' : ''}`],
  ['free', (n) => `${n} pas connecté${n > 1 ? 's' : ''}`],
  ['idle', (n) => `${n} sans cookie à classer`],
]

export function guestSummary(guests: AdminGuest[]): { state: GuestState; text: string }[] {
  const count = (s: GuestState) => guests.filter((g) => guestState(g) === s).length
  return SUMMARY.filter(([s]) => count(s) > 0).map(([s, text]) => ({ state: s, text: text(count(s)) }))
}
