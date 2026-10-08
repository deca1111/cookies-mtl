'use client'

import type { CSSProperties } from 'react'
import { usePolling } from '@/components/contest/usePolling'
import type { AdminView } from '@/lib/contest-state'
import { ContestHeader } from './ContestHeader'
import { GuestPanel } from './GuestPanel'
import { phaseColorVar } from './phase-style'
import { PhaseTimeline } from './PhaseTimeline'
import { PilotPanel } from './PilotPanel'
import { PlatePanel } from './PlatePanel'

// Écran de pilotage (spec §9), pensé laptop : trois colonnes. Le polling montre
// les votes arriver ; chaque action relit l'état tout de suite après — `force`
// (Task 8) court-circuite le verrou anti-chevauchement : sans lui, une action
// pendant qu'un sondage périodique est déjà en vol resterait invisible jusqu'à
// 2,5 s de plus, ce qui se voit sur un geste admin (ajouter, supprimer…).
export function ContestControl({ initial }: { initial: AdminView }) {
  const { data: view, refresh, offline, gone, error } = usePolling<AdminView>(`/api/admin/concours/${initial.contest.id}/etat`, initial)
  const done = () => void refresh(true)
  return (
    <main
      className="flex min-h-dvh flex-col gap-6 border-t-[3px] p-6"
      style={{ '--phase': phaseColorVar(view.contest.phase), borderTopColor: 'var(--phase)' } as CSSProperties}
    >
      <ContestHeader contestId={view.contest.id} name={view.contest.name} onDone={done} />
      <PhaseTimeline
        contestId={view.contest.id}
        phase={view.contest.phase}
        complete={view.complete}
        rankableGuests={view.guests.filter((g) => g.rankable > 0).length}
        onDone={done}
      />
      {(offline || gone || error) && (
        <p className="rounded-[var(--radius-field)] border border-[color:var(--danger)] px-3 py-2 text-[13px] text-[color:var(--danger)]">
          {gone
            ? 'Ce concours n’existe plus — il a peut-être été supprimé ailleurs.'
            : offline
              ? 'Connexion perdue — nouvel essai automatique…'
              : 'Session expirée ou erreur serveur — reconnecte-toi si ça persiste.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <GuestPanel contestId={view.contest.id} phase={view.contest.phase} guests={view.guests} onDone={done} />
        <PlatePanel contestId={view.contest.id} phase={view.contest.phase} plates={view.plates} guests={view.guests} onDone={done} />
        <PilotPanel view={view} onDone={done} />
      </div>
    </main>
  )
}
