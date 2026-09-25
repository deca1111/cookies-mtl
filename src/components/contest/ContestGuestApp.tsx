'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { claimNameAction, saveBallotAction } from '@/app/actions/contest-guest'
import type { GuestView } from '@/lib/contest-state'
import { GuestResults } from './GuestResults'
import { LanguagePicker } from './LanguagePicker'
import { NamePicker } from './NamePicker'
import { RankingBoard } from './RankingBoard'
import { useContestLang } from './useContestLang'
import { usePolling } from './usePolling'

export function ContestGuestApp({ secret, initial }: { secret: string; initial: GuestView }) {
  const { ready, lang, setLang, t } = useContestLang()
  const { data: view, refresh, offline, gone } = usePolling<GuestView>(`/api/concours/${secret}/etat`, initial)

  // Le classement vit localement pendant qu'on l'édite : le polling ne doit pas
  // l'écraser avec une version serveur en retard d'un aller-retour. Il n'est
  // repris du serveur qu'au changement d'identité.
  const [ranking, setRanking] = useState<number[]>(initial.myBallot)
  const [saveError, setSaveError] = useState(false)
  // Distingue « nom déjà pris entre-temps » (l'invité doit en choisir un autre)
  // d'une panne quelconque (réessayer le même) : deux bandeaux différents dans
  // NamePicker, tous deux traduits (spec §8).
  const [claimNotice, setClaimNotice] = useState<'taken' | 'failed' | null>(null)
  const unsent = useRef<number[] | null>(null)
  const meId = view.me?.id ?? null
  const hadIdentity = useRef(initial.me !== null)
  const [released, setReleased] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRanking(view.myBallot)
    setSaveError(false)
    if (meId === null && hadIdentity.current) setReleased(true)
    hadIdentity.current = meId !== null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId])

  const send = async (next: number[]) => {
    unsent.current = next
    try {
      const res = await saveBallotAction(secret, next)
      if (unsent.current === next) unsent.current = null
      // « closed » (vote terminé), « no-identity » (nom relâché) et « not-found »
      // (concours disparu) ne sont pas des échecs à signaler par ce bandeau :
      // l'écran change de lui-même (verrouillage ou écran du nom), un
      // « saveFailed » qui traînerait par-dessus n'aiderait personne.
      const silent = res.ok || res.error === 'closed' || res.error === 'no-identity' || res.error === 'not-found'
      setSaveError(!silent)
      if (!res.ok) void refresh()
    } catch {
      setSaveError(true)
    }
  }

  // La ref tient toujours la dernière fermeture de `send` sans réabonner
  // l'écouteur à chaque rendu : `send` ne dépend que de refs et de `secret`
  // (constant pour la vie du composant), donc une fermeture "en retard" d'un
  // rendu se comporte de toute façon à l'identique. Écrire une ref pendant le
  // rendu est interdit (react-hooks/refs) : la mise à jour passe par un effet
  // sans tableau de dépendances, rejoué à chaque rendu.
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })

  // Le navigateur peut prévenir avant le prochain sondage (jusqu'à 2,5 s
  // d'attente) : un seul abonnement pour la vie du composant (spec §11).
  useEffect(() => {
    const onOnline = () => {
      if (unsent.current) void sendRef.current(unsent.current)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // Un sondage réussi (donc une nouvelle valeur de `view`) prouve que le réseau
  // fonctionne : si un bulletin est resté en attente — y compris quand
  // saveBallotAction avait échoué sans jamais faire passer `offline` à vrai —
  // on le renvoie ici plutôt que d'attendre un hypothétique retour hors-ligne
  // qui ne viendra pas.
  useEffect(() => {
    if (unsent.current) void send(unsent.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const onChange = (next: number[]) => {
    setRanking(next)
    void send(next)
  }

  const claim = async (id: number): Promise<boolean> => {
    setClaimNotice(null)
    try {
      const res = await claimNameAction(secret, id)
      if (!res.ok) {
        setClaimNotice(res.error === 'taken' ? 'taken' : 'failed')
        return false
      }
      setReleased(false)
      // Forcé : sans ça, un sondage périodique déjà en vol ignorerait cette
      // relecture et le nom qu'on vient de réclamer resterait affiché comme
      // libre jusqu'à 2,5 s de plus (spec §8).
      await refresh(true)
      return true
    } catch {
      setClaimNotice('failed')
      return false
    }
  }

  let body: ReactNode
  if (!ready) body = null
  else if (gone) body = <p className="pt-16 text-center text-[16px] text-[color:var(--text-body)]">{t('notFound')}</p>
  else if (!lang) body = <LanguagePicker onPick={setLang} />
  else if (!view.me) {
    const notice = released ? t('released') : claimNotice === 'taken' ? t('nameTaken') : claimNotice === 'failed' ? t('claimFailed') : null
    body = <NamePicker guests={view.guests} onClaim={claim} t={t} notice={notice} />
  } else if (view.phase === 'preparation') {
    body = (
      <div className="pt-16 text-center">
        <h1 className="font-display text-[24px] text-[color:var(--text-strong)]">{t('waitingTitle')}</h1>
        <p className="mt-2 text-[15px] text-[color:var(--text-body)]">{t('waitingBody')}</p>
      </div>
    )
  } else if (view.final && view.results) {
    body = <GuestResults results={view.results} myBallot={view.myBallot} t={t} lang={lang} />
  } else if (view.phase === 'voting') {
    body = <RankingBoard plates={view.plates} ranking={ranking} onChange={onChange} locked={false} t={t} />
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <div className="pt-6 text-center">
          <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('eyesOnScreen')}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--text-body)]">{t('closedBody')}</p>
        </div>
        <RankingBoard plates={view.plates} ranking={ranking} onChange={() => {}} locked t={t} />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-[color:var(--bg)] px-4 pb-10 pt-4">
      <header className="flex items-center justify-between gap-3">
        <span className="font-display truncate text-[16px] text-[color:var(--text-muted)]">{view.name}</span>
        {lang && (
          <div className="flex items-center gap-3">
            {view.me && <span className="text-[13px] text-[color:var(--text-body)]">{t('hello', { name: view.me.name })}</span>}
            <button type="button" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[12px] text-[color:var(--text-body)]">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </div>
        )}
      </header>
      {(offline || saveError) && lang && (
        <p role="status" className="rounded-[var(--radius-field)] bg-[color:var(--accent-wash)] p-3 text-[13px] text-[color:var(--text-body)]">
          {offline ? t('offline') : t('saveFailed')}
        </p>
      )}
      {body}
    </main>
  )
}
