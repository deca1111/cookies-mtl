'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { claimNameAction, releaseSelfAction, saveBallotAction } from '@/app/actions/contest-guest'
import { IconChevronDown } from '@/components/icons'
import type { GuestView } from '@/lib/contest-state'
import { ChangeNameSheet } from './ChangeNameSheet'
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
  // Compte les appels à `send` : sert UNIQUEMENT à savoir, après les `await` du
  // retraitement d'un bulletin « invalid » ci-dessous, si un envoi plus récent a
  // pris le relais entre-temps (l'invité a rejoué pendant la relecture). `unsent`
  // ne peut pas jouer ce rôle ici : il est effacé tout de suite après la première
  // tentative (comme avant ce correctif), précisément pour que l'effet `[view]`
  // et l'écouteur `online` ne relancent pas un envoi en double pendant la relance.
  const sendSeq = useRef(0)
  const meId = view.me?.id ?? null
  const hadIdentity = useRef(initial.me !== null)
  const [released, setReleased] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

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
    const mySend = ++sendSeq.current
    try {
      const res = await saveBallotAction(secret, next)
      // Cette tentative est retombée : elle ne doit plus jouer les prolongations
      // pour l'écouteur `online`/l'effet `[view]`, que ce soit un succès ou un
      // échec — seul le bloc « invalid » ci-dessous continue au-delà de ce point.
      if (unsent.current === next) unsent.current = null
      if (res.ok) {
        setSaveError(false)
        return
      }
      if (res.error === 'invalid') {
        // Course avec l'admin (assiette supprimée, auteur changé) pendant l'envoi :
        // le serveur garde l'ancien bulletin et rien ne retente jamais tout seul —
        // renvoyer `next` tel quel échouerait de nouveau. On relit l'état (`force`,
        // sinon un sondage déjà en vol pourrait absorber la relecture), on filtre
        // le classement local sur les assiettes encore classables, et on retente
        // UNE fois. Jamais le bandeau « nouvel essai en cours » sans rien en cours.
        const freshView = await refresh(true)
        // Un envoi plus récent est déjà parti entre-temps (l'invité a rejoué
        // pendant la relecture) : il porte la vérité, cette tentative s'efface.
        if (sendSeq.current !== mySend) return
        const allowed = new Set((freshView ?? view).plates.map((p) => p.id))
        const retryRanking = next.filter((id) => allowed.has(id))
        let retryOk = false
        try {
          retryOk = (await saveBallotAction(secret, retryRanking)).ok
        } catch {
          retryOk = false
        }
        if (sendSeq.current !== mySend) return
        // Échec persistant : on abandonne plutôt que de boucler, et on repart du
        // bulletin serveur — jamais un bandeau qui prétendrait retenter sans rien
        // retenter.
        setRanking(retryOk ? retryRanking : (freshView ?? view).myBallot)
        setSaveError(false)
        return
      }
      // « closed » (vote terminé) et « no-identity » (nom relâché) ne sont pas des
      // échecs à signaler par ce bandeau : l'écran change de lui-même (verrouillage
      // ou écran du nom), un « saveFailed » qui traînerait par-dessus n'aiderait
      // personne. Idem « not-found » : le concours a disparu, `gone` s'en charge.
      setSaveError(false)
      void refresh()
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

  // Changer de nom (spec PR 2 §5) : le bulletin est effacé côté serveur. On
  // oublie tout envoi en attente (sinon il repartirait sous l'identité vide) et
  // on abaisse `hadIdentity` AVANT la relecture, pour que la perte d'identité ne
  // soit pas prise pour une libération par l'organisateur.
  const changeName = async (): Promise<boolean> => {
    try {
      const res = await releaseSelfAction(secret)
      if (!res.ok) return false
    } catch {
      return false
    }
    unsent.current = null
    sendSeq.current++
    hadIdentity.current = false
    setRanking([])
    setSheetOpen(false)
    await refresh(true)
    return true
  }

  const canChangeName = view.me !== null && (view.phase === 'preparation' || view.phase === 'voting')
  // La phase peut basculer (clôture) pendant que la feuille est ouverte : sans
  // cette garde, elle resterait affichée avec un bouton qui n'a plus lieu d'être
  // (même motif que Scene.tsx — ajustement d'état pendant le rendu).
  if (sheetOpen && !canChangeName) setSheetOpen(false)

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
          <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t(view.phase === 'reveal' ? 'revealTitle' : 'closedTitle')}</h1>
          {/* Point 7 de la vague de correction : rien classé, rien « enregistré » —
              le texte par défaut mentirait à l'invité qui n'a pas voté. */}
          <p className="mt-2 text-[15px] text-[color:var(--text-body)]">{t(ranking.length === 0 ? 'closedBodyEmpty' : 'closedBody')}</p>
        </div>
        <RankingBoard plates={view.plates} ranking={ranking} onChange={() => {}} locked t={t} />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-[color:var(--bg)] px-4 pb-10 pt-4">
      <header className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marque statique */}
        <img src="/brand/logo.svg" alt="" className="h-7 w-7" />
        <span className="font-display flex-1 truncate text-[15px] text-[color:var(--text-strong)]">{view.name}</span>
        {lang && view.me && (canChangeName ? (
          <button type="button" onClick={() => setSheetOpen(true)} aria-label={`${view.me.name} — ${t('changeName')}`}
            className="flex items-center gap-1 rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[13px] text-[color:var(--text-body)]">
            {view.me.name}
            <IconChevronDown size={12} />
          </button>
        ) : (
          <span className="text-[13px] text-[color:var(--text-body)]">{view.me.name}</span>
        ))}
        {lang && (
          <button type="button" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-[12px] text-[color:var(--text-body)]">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
        )}
      </header>
      {(offline || saveError) && lang && (
        <p role="status" className="rounded-[var(--radius-field)] bg-[color:var(--accent-wash)] p-3 text-[13px] text-[color:var(--text-body)]">
          {offline ? t('offline') : t('saveFailed')}
        </p>
      )}
      {body}
      {sheetOpen && view.me && lang && <ChangeNameSheet name={view.me.name} t={t} onConfirm={changeName} onClose={() => setSheetOpen(false)} />}
    </main>
  )
}
