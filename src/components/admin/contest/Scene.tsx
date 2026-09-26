'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { setRevealStepAction } from '@/app/actions/contest-admin'
import { usePolling } from '@/components/contest/usePolling'
import { PlateTag } from '@/components/contest/PlateTag'
import { Podium } from '@/components/contest/Podium'
import { contestDict, fmt, ordinal, type ContestMsgKey } from '@/lib/contest-i18n'
import { podium } from '@/lib/contest-podium'
import type { AdminView, ResultRow } from '@/lib/contest-state'
import { runAction } from './runAction'

// Un rang moyen est une fraction ("3") formatée en "3,0" : `toFixed` rendrait un
// point, jamais une virgule. Nombres au format `fr-CA` dans les deux langues
// (spec PR 2 §6), plutôt que la locale du navigateur qui piloterait.
const formatAvgRank = (n: number) => new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)

// Bilingue (spec PR 2 §6) : pas de sélecteur de langue, le français en grand et
// l'anglais en petit italique estompé juste dessous, toujours les deux. La taille
// est posée sur le conteneur : `0.45em` se calcule alors sur celle du français.
const fr = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
const en = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.en[k], v) : contestDict.en[k])
function Bi({ k, v, className, align = 'center' }: { k: ContestMsgKey; v?: Record<string, string | number>; className: string; align?: 'center' | 'start' }) {
  return (
    <span className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} ${className}`}>
      <span>{fr(k, v)}</span>
      {/* Lisibilité TV (vague de correction PR 2, point 2) : 0.6em/opacity-70 plutôt
          que 0.45em/opacity-60, trop estompé pour être lu depuis le fond d'une salle. */}
      <span className="text-[0.6em] italic opacity-70">{en(k, v)}</span>
    </span>
  )
}

const SHELL = 'relative flex min-h-dvh flex-col items-center gap-8 overflow-hidden p-12 pb-16 text-center text-[#f4ebdd]'
const HALO = 'radial-gradient(circle at 50% 45%, #3d2e20, #1f170f 75%)'
// Halo plus chaud pour le 1er.
const HALO_FIRST = 'radial-gradient(circle at 50% 45%, #5a4126, #1f170f 78%)'

// Scène de révélation (spec §10, habillage spec PR 2 §6). L'étape vit en base :
// recharger la page ou piloter depuis un autre écran reprend exactement au même point.
export function Scene({ initial }: { initial: AdminView }) {
  const { data: view, refresh, offline, gone, error: pollError } = usePolling<AdminView>(`/api/admin/concours/${initial.contest.id}/etat`, initial, 1500)
  const { contest, rows, steps } = view

  const [localStep, setLocalStep] = useState<number | null>(null)
  const [stepError, setStepError] = useState(false)
  // Deux témoins d'un même « une requête est en vol », pour deux usages qui ne
  // peuvent pas partager le même : `inFlightRef` (ref) est lu et écrit de façon
  // synchrone dans le gestionnaire clavier — un verrou anti-rafale a besoin de
  // cette synchronicité, un `useState` arriverait trop tard face à deux appuis
  // rapprochés. `awaitingServer` (state) est son miroir, lu pendant le rendu —
  // React interdit de lire `ref.current` au rendu (`react-hooks/refs`), donc
  // l'ajustement de `localStep` ci-dessous doit se fier à cet état, pas au ref.
  const [awaitingServer, setAwaitingServer] = useState(false)
  const inFlightRef = useRef(false)

  // `localStep` ne sert qu'à ponter LA requête en vol : dès qu'elle est retombée
  // (succès ou échec), le serveur redevient la seule vérité. Sans ce filet, une
  // étape refusée (verrou, session expirée) laissait `localStep` bloqué sur la
  // valeur jamais atteinte par le serveur — `max()` plus bas l'affichait alors
  // indéfiniment, masquant tout recul (PilotPanel, remise à zéro de phase…)
  // jusqu'à ce que le serveur revienne PAR HASARD à cette même valeur. Le garde
  // `!awaitingServer` laisse filer l'optimisme le temps de la requête en cours,
  // mais dès qu'aucune n'est en vol, tout écart avec le serveur (un autre écran
  // a bougé l'étape, un sondage périodique l'a changée…) efface l'optimisme.
  // Ajusté pendant le rendu (pattern React officiel pour dériver un état à partir
  // des props courantes) plutôt que dans un effet séparé : un `setState`
  // synchrone dans un effet déclenche un rendu en cascade évitable ici.
  if (!awaitingServer && localStep !== null && contest.revealStep !== localStep) {
    setLocalStep(null)
  }

  // Étape affichée : la plus avancée entre le serveur et un changement clavier
  // tout juste envoyé, le temps que ce dernier soit confirmé ou rejeté. Sans ce
  // garde-fou, un sondage périodique parti juste avant l'écriture reviendrait
  // avec l'ancienne étape et ferait clignoter la scène en arrière une fraction
  // de seconde. (Ne protège que l'avance : reculer au clavier peut réafficher
  // brièvement l'ancienne valeur avant que le sondage suivant ne rattrape — cas
  // rare, la scène n'étant pensée que pour avancer.)
  const effectiveStep = localStep !== null ? Math.max(localStep, contest.revealStep) : contest.revealStep

  useEffect(() => {
    const go = async (s: number) => {
      // Un appui pendant qu'un envoi précédent est encore en vol est ignoré :
      // sans ce verrou, deux flèches rapprochées partiraient dans le désordre et
      // pourraient laisser la scène sur une étape antérieure à celle voulue.
      if (inFlightRef.current) return
      inFlightRef.current = true
      setAwaitingServer(true)
      const clamped = Math.max(0, Math.min(s, steps.length - 1))
      setLocalStep(clamped)
      // `force: true` — au clavier, chaque appui doit avancer la scène tout de
      // suite ; sans lui, un sondage déjà en vol (toutes les 1,5 s ici) pourrait
      // absorber la relecture et retarder l'étape suivante jusqu'au prochain tour.
      // `runAction` : la scène tourne sans surveillance, une levée (session admin
      // expirée, réseau) ne doit jamais rester une rejection non gérée.
      const res = await runAction(setRevealStepAction(contest.id, clamped))
      setStepError(!res.ok)
      // Échec (verrou, session expirée…) : on efface l'optimisme tout de suite,
      // sans attendre `refresh` — sinon l'étape refusée resterait affichée le
      // temps de cet aller-retour réseau (le garde `!awaitingServer` ci-dessus
      // ne s'applique qu'une fois `go` terminé, plus bas).
      if (!res.ok) setLocalStep(null)
      await refresh(true)
      inFlightRef.current = false
      setAwaitingServer(false)
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

  // Indicateur discret, en coin d'écran : jamais bloquant (la scène tourne sans
  // surveillance côté salle), mais visible pour qui regarde depuis la régie.
  const indicator: string | null = gone
    ? 'Concours introuvable — supprimé ?'
    : offline
      ? 'Connexion perdue…'
      : stepError
        ? 'Étape non appliquée, réessaie.'
        : pollError
          ? 'Session expirée ou erreur serveur.'
          : null

  // Habillage commun (spec PR 2 §6) : halo chocolat, logo discret, points de
  // progression. La scène est une TV : elle reste sombre quel que soit le thème
  // du site, d'où les couleurs fixes plutôt que les jetons.
  let content: ReactNode
  let halo = HALO
  let finalScreen = false

  if (contest.phase !== 'reveal') {
    content = (
      <>
        <h1 className="font-display text-[72px] leading-none">{contest.name}</h1>
        <Bi k="waitingReveal" className="text-[32px]" />
      </>
    )
  } else {
    const step = steps[Math.min(effectiveStep, steps.length - 1)]
    const byId = new Map(rows.map((r) => [r.plateId, r]))

    if (step.kind === 'title') {
      const voters = new Set(view.guests.filter((g) => g.ranked >= 2).map((g) => g.id)).size
      content = (
        <>
          <h1><Bi k="verdict" className="font-display text-[110px] leading-none" /></h1>
          {/* Singulier (point 8 de la vague de correction) : « 1 bulletin », pas « 1 bulletins ». */}
          <Bi k={voters === 1 ? 'ballotsPlatesOne' : 'ballotsPlates'} v={{ b: voters, p: rows.length }} className="text-[32px]" />
        </>
      )
    } else if (step.kind === 'final') {
      finalScreen = true
      content = (
        <>
          <h1><Bi k="finalRanking" className="font-display text-[56px] leading-none" /></h1>
          <Podium rows={rows} size="tv" text={fr} lang="fr" subLang="en" />
          <ol data-testid="final-rest" className="grid w-full max-w-6xl grid-cols-1 gap-3 text-left xl:grid-cols-2">
            {podium(rows).rest.map((r) => (
              <li key={r.plateId} className="flex items-baseline gap-4 rounded-[18px] bg-[#fffdf9]/10 px-6 py-3 text-[26px]">
                <span className="flex min-w-24 flex-col font-display leading-none text-[#d29a55]">
                  {r.position === null ? fr('unranked') : ordinal('fr', r.position)}
                  <span className="mt-1 text-[16px] italic opacity-60">{r.position === null ? en('unranked') : ordinal('en', r.position)}</span>
                </span>
                <span className="font-display">{fr('plateTag', { n: r.number })}</span>
                <span className="flex-1 font-display text-[#7f98e0]">{r.authors.join(' & ') || '?'}</span>
                {r.score !== null && <span className="opacity-70">{fr('score', { n: r.score })}</span>}
              </li>
            ))}
          </ol>
        </>
      )
    } else {
      const shown = step.plateIds.map((id) => byId.get(id)).filter((r): r is ResultRow => !!r)
      // Écart avec le rang suivant : « +12 pts devant le 2e » (spec §10). `shown[0]`
      // peut être absent (assiette supprimée entre-temps) : sans ce garde,
      // `shown[0]?.score !== null` valait `true` même pour un tableau vide
      // (`undefined !== null`), et l'accès à `shown[0].score!` plantait.
      const nextRow = rows.find((r) => r.position !== null && r.position > step.position)
      const gap = shown[0] && shown[0].score !== null && nextRow?.score != null ? shown[0].score! - nextRow.score : null
      const first = step.position === 1
      // Ex æquo : les auteurs (et rangs moyens) de chaque assiette sont repérés
      // par leur « N° X » dans la colonne de droite.
      const tagOf = (r: ResultRow) => (shown.length > 1 ? `${fr('plateTag', { n: r.number })} · ` : '')
      if (first) halo = HALO_FIRST

      content = (
        <div className="flex items-center gap-16">
          <div className="flex flex-col items-center">
            <span className={`font-display leading-none ${first ? 'text-[260px] text-[#f3c787] [text-shadow:0_0_60px_rgba(243,199,135,0.4)]' : step.podium ? 'text-[220px] text-[#d29a55]' : 'text-[180px] text-[#d29a55]'}`}>
              {ordinal('fr', step.position)}
            </span>
            <span className="text-[36px] italic opacity-60">{ordinal('en', step.position)}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-10">
            {shown.map((r) => (
              <div key={r.plateId} className="flex flex-col items-center gap-4">
                <PlateTag label={fr('plateTag', { n: r.number })} size={first ? 'xl' : 'lg'} tilt score={r.score} scoreLabel={r.score === null ? undefined : fr('score', { n: r.score })} />
                {r.label && <p className="text-[22px] opacity-70">{r.label}</p>}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-start gap-4 text-left">
            <Bi k="bakedBy" className="text-[32px]" align="start" />
            {step.showAuthors ? (
              shown.map((r) => (
                <p key={r.plateId} className="font-display text-[64px] leading-tight text-[#7f98e0]">
                  {shown.length > 1 && <span className="text-[28px] opacity-70">{tagOf(r)}</span>}
                  {r.authors.join(' & ') || '?'}
                </p>
              ))
            ) : (
              <div className="rounded-[20px] border-4 border-dashed border-[#f4ebdd]/25 px-10 py-6 text-[56px] opacity-50">
                <span aria-hidden="true">?</span>
                <span className="sr-only">{fr('authorsHidden')}</span>
              </div>
            )}
            {shown.map((r) => r.avgRank !== null && (
              <div key={r.plateId} className="flex flex-col">
                <span className="text-[24px] opacity-80">{tagOf(r)}{fr('avgRank', { n: formatAvgRank(r.avgRank) })}</span>
                <span className="text-[18px] italic opacity-60">{en('avgRank', { n: formatAvgRank(r.avgRank) })}</span>
              </div>
            ))}
            {/* `k` diffère d'une langue à l'autre (« 2e » / « 2nd ») : deux lignes à la main plutôt que <Bi>. */}
            {step.podium && gap !== null && gap > 0 && nextRow?.position != null && (
              <div className="flex flex-col">
                <span className="text-[28px]">{fr('ptsAhead', { n: gap, k: ordinal('fr', nextRow.position) })}</span>
                <span className="text-[20px] italic opacity-60">{en('ptsAhead', { n: gap, k: ordinal('en', nextRow.position) })}</span>
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  const body: ReactNode = (
    <main className={`${SHELL} ${finalScreen ? 'justify-start' : 'justify-center'}`} style={{ background: halo }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marque statique */}
      <img src="/brand/logo.svg" alt="" className="absolute left-6 top-6 h-16 w-16 opacity-80" />
      {content}
      {contest.phase === 'reveal' && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden="true">
          {steps.map((_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full bg-[#f4ebdd] ${i <= effectiveStep ? 'opacity-90' : 'opacity-25'}`} />)}
        </div>
      )}
    </main>
  )

  return (
    <>
      {body}
      {/* Contraste (point 10) : la scène reste sombre quel que soit le thème, donc
          `var(--danger)` (pensée pour un fond clair) n'y est pas assez lisible —
          la couleur fixe de la phase « closed » sombre (#e5907a) convient partout. */}
      {indicator && <p className="fixed bottom-3 right-4 text-[12px]" style={{ color: '#e5907a' }}>{indicator}</p>}
    </>
  )
}
