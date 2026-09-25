'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { setRevealStepAction } from '@/app/actions/contest-admin'
import { usePolling } from '@/components/contest/usePolling'
import type { AdminView, ResultRow } from '@/lib/contest-state'
import { runAction } from './runAction'

// Scène de révélation (spec §10) — version fonctionnelle et sobre ; le design
// (et le traitement bilingue) viendra en PR 2. L'étape vit en base : recharger
// la page ou piloter depuis un autre écran reprend exactement au même point.
export function Scene({ initial }: { initial: AdminView }) {
  const { data: view, refresh, offline, gone } = usePolling<AdminView>(`/api/admin/concours/${initial.contest.id}/etat`, initial, 1500)
  const { contest, rows, steps } = view

  const [localStep, setLocalStep] = useState<number | null>(null)
  const [stepError, setStepError] = useState(false)
  const inFlightRef = useRef(false)

  // Une fois que le serveur a exactement rattrapé l'étape envoyée, on relâche
  // l'optimisme local : le prochain sondage refait foi, y compris pour reculer.
  // Ajusté pendant le rendu (pattern React officiel pour dériver un état à partir
  // des props courantes) plutôt que dans un effet séparé : un `setState`
  // synchrone dans un effet déclenche un rendu en cascade évitable ici.
  if (localStep !== null && contest.revealStep === localStep) {
    setLocalStep(null)
  }

  // Étape affichée : la plus avancée entre le serveur et un changement clavier
  // tout juste envoyé. Sans ce garde-fou, un sondage périodique parti juste
  // avant l'écriture reviendrait avec l'ancienne étape et ferait clignoter la
  // scène en arrière une fraction de seconde. (Ne protège que l'avance : reculer
  // au clavier peut réafficher brièvement l'ancienne valeur avant que le sondage
  // suivant ne rattrape — cas rare, la scène n'étant pensée que pour avancer.)
  const effectiveStep = localStep !== null ? Math.max(localStep, contest.revealStep) : contest.revealStep

  useEffect(() => {
    const go = async (s: number) => {
      // Un appui pendant qu'un envoi précédent est encore en vol est ignoré :
      // sans ce verrou, deux flèches rapprochées partiraient dans le désordre et
      // pourraient laisser la scène sur une étape antérieure à celle voulue.
      if (inFlightRef.current) return
      inFlightRef.current = true
      const clamped = Math.max(0, Math.min(s, steps.length - 1))
      setLocalStep(clamped)
      // `force: true` — au clavier, chaque appui doit avancer la scène tout de
      // suite ; sans lui, un sondage déjà en vol (toutes les 1,5 s ici) pourrait
      // absorber la relecture et retarder l'étape suivante jusqu'au prochain tour.
      // `runAction` : la scène tourne sans surveillance, une levée (session admin
      // expirée, réseau) ne doit jamais rester une rejection non gérée.
      const res = await runAction(setRevealStepAction(contest.id, clamped))
      setStepError(!res.ok)
      await refresh(true)
      inFlightRef.current = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (contest.phase !== 'reveal') return
      // Une touche maintenue répète l'évènement plusieurs fois par seconde : sans
      // ce filtre, un seul appui enverrait une rafale d'étapes. Les raccourcis
      // système (Ctrl/Cmd/Alt+flèche) sont eux aussi laissés de côté.
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        void go(effectiveStep + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        void go(effectiveStep - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contest.id, contest.phase, effectiveStep, refresh, steps.length])

  const shell = 'flex min-h-dvh flex-col items-center justify-center gap-8 bg-[color:var(--bg)] p-12 text-center'

  // Indicateur discret, en coin d'écran : jamais bloquant (la scène tourne sans
  // surveillance côté salle), mais visible pour qui regarde depuis la régie.
  const indicator: string | null = gone
    ? 'Concours introuvable — supprimé ?'
    : offline
      ? 'Connexion perdue…'
      : stepError
        ? 'Étape non appliquée, réessaie.'
        : null

  let body: ReactNode

  if (contest.phase !== 'reveal') {
    body = (
      <main className={shell}>
        <h1 className="font-display text-[56px] text-[color:var(--text-strong)]">{contest.name}</h1>
        <p className="text-[24px] text-[color:var(--text-muted)]">En attente de la révélation…</p>
      </main>
    )
  } else {
    const step = steps[Math.min(effectiveStep, steps.length - 1)]
    const byId = new Map(rows.map((r) => [r.plateId, r]))

    if (step.kind === 'title') {
      const voters = new Set(view.guests.filter((g) => g.ranked >= 2).map((g) => g.id)).size
      body = (
        <main className={shell}>
          <h1 className="font-display text-[80px] leading-none text-[color:var(--text-strong)]">Le verdict</h1>
          <p className="text-[28px] text-[color:var(--text-body)]">{voters} bulletins · {rows.length} assiettes</p>
        </main>
      )
    } else if (step.kind === 'final') {
      body = (
        <main className="flex min-h-dvh flex-col gap-6 bg-[color:var(--bg)] p-12">
          <h1 className="font-display text-[48px] text-[color:var(--text-strong)]">Classement final</h1>
          <ol className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {rows.map((r) => (
              <li key={r.plateId} className="flex items-baseline gap-4 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-4 text-[24px]">
                <span className="font-display w-14 text-[color:var(--accent-ink)]">{r.position ?? '—'}</span>
                <span className="flex-1 text-[color:var(--text-strong)]">Assiette {r.number} — {r.authors.join(' & ') || '?'}</span>
                <span className="text-[color:var(--text-muted)]">{r.score ?? '—'}</span>
              </li>
            ))}
          </ol>
        </main>
      )
    } else {
      const shown = step.plateIds.map((id) => byId.get(id)).filter((r): r is ResultRow => !!r)
      // Écart avec le rang suivant : « +12 pts devant le 2e » (spec §10). `shown[0]`
      // peut être absent (assiette supprimée entre-temps) : sans ce garde,
      // `shown[0]?.score !== null` valait `true` même pour un tableau vide
      // (`undefined !== null`), et l'accès à `shown[0].score!` plantait.
      const nextRow = rows.find((r) => r.position !== null && r.position > step.position)
      const gap = shown[0] && shown[0].score !== null && nextRow?.score != null ? shown[0].score! - nextRow.score : null

      body = (
        <main className={shell}>
          <p className={`font-display ${step.podium ? 'text-[120px]' : 'text-[80px]'} leading-none text-[color:var(--accent-ink)]`}>
            {step.position === 1 ? '1er' : `${step.position}e`}
          </p>
          <div className="flex flex-wrap justify-center gap-10">
            {shown.map((r) => (
              <div key={r.plateId} className="flex flex-col items-center gap-2">
                <p className="font-display text-[56px] text-[color:var(--text-strong)]">Assiette {r.number}</p>
                {r.label && <p className="text-[24px] text-[color:var(--text-muted)]">{r.label}</p>}
                <p className="text-[64px] font-medium text-[color:var(--text-strong)]">{r.score}</p>
                <p className="text-[22px] text-[color:var(--text-muted)]">rang moyen {r.avgRank?.toFixed(1)}</p>
                {step.showAuthors && <p className="font-display text-[48px] text-[color:var(--accent-blue)]">{r.authors.join(' & ') || '?'}</p>}
              </div>
            ))}
          </div>
          {step.podium && gap !== null && gap > 0 && (
            <p className="text-[24px] text-[color:var(--text-body)]">+{gap} pts devant le suivant</p>
          )}
        </main>
      )
    }
  }

  return (
    <>
      {body}
      {indicator && <p className="fixed bottom-3 right-4 text-[12px] text-[color:var(--danger)]">{indicator}</p>}
    </>
  )
}
