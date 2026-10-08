import type { CSSProperties } from 'react'
import { PlateTag } from '@/components/contest/PlateTag'
import { Medal, MysteryMedal } from '@/components/contest/Medal'
import { Podium } from '@/components/contest/Podium'
import { contestDict, fmt, ordinal, type ContestMsgKey } from '@/lib/contest-i18n'
import { podium } from '@/lib/contest-podium'
import type { DuelStage } from '@/lib/contest-reveal'
import type { ResultRow } from '@/lib/contest-state'

// Slides de la scène de révélation (spec PR 2 §6, revues après l'UAT). La scène
// est une TV : sombre quel que soit le thème, d'où les couleurs fixes. Les
// animations (globals.css, `.rv-*`) jouent au montage d'une slide ou à l'ajout
// d'une classe : la scène garde la même instance d'une étape à l'autre d'une
// même slide (clé stable), pour qu'une étape « auteurs » ne rejoue pas l'entrée.

// Bilingue : pas de sélecteur de langue, le français en grand et l'anglais en
// petit italique estompé juste dessous, toujours les deux. La taille est posée
// sur le conteneur : `0.6em` se calcule alors sur celle du français.
export const fr = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.fr[k], v) : contestDict.fr[k])
export const en = (k: ContestMsgKey, v?: Record<string, string | number>) => (v ? fmt(contestDict.en[k], v) : contestDict.en[k])
export function Bi({ k, v, className, align = 'center' }: { k: ContestMsgKey; v?: Record<string, string | number>; className: string; align?: 'center' | 'start' }) {
  return (
    <span className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} ${className}`}>
      <span>{fr(k, v)}</span>
      {/* Lisibilité TV : 0.6em/opacity-70, lisible depuis le fond d'une salle. */}
      <span className="text-[0.6em] italic opacity-70">{en(k, v)}</span>
    </span>
  )
}

const authorsOf = (r: ResultRow) => r.authors.join(' & ') || '?'
const scoreOf = (r: ResultRow) => (r.score === null ? undefined : fr('score', { n: r.score }))

// Miettes de cookie qui jaillissent derrière le gagnant, aux couleurs du cookie
// de la marque. Pseudo-aléatoire à graine fixe : même rendu côté serveur et
// client (pas d'écart d'hydratation), et la scène reste identique au rechargement.
const CRUMB_COLORS = ['#502712', '#a6561c', '#d0914a', '#f3c787']

function crumbStyles(seed: number, count: number): CSSProperties[] {
  let s = (seed * 7919) % 233280
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: count }, (_, i) => {
    const size = 8 + rnd() * 18
    return {
      width: size,
      height: size * (0.65 + rnd() * 0.5),
      background: CRUMB_COLORS[i % CRUMB_COLORS.length],
      borderRadius: `${40 + rnd() * 30}% ${30 + rnd() * 40}% ${45 + rnd() * 30}% ${35 + rnd() * 30}%`,
      '--dx': `${(rnd() - 0.5) * 1200}px`,
      '--up': `${140 + rnd() * 380}px`,
      '--rot': `${(rnd() - 0.5) * 720}deg`,
      '--dur': `${1500 + rnd() * 900}ms`,
      '--delay': `${450 + rnd() * 300}ms`,
    } as CSSProperties
  })
}

export function Crumbs({ seed, count = 40 }: { seed: number; count?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {crumbStyles(seed, count).map((style, i) => <span key={i} className="rv-crumb" style={style} />)}
    </div>
  )
}

export function TitleSlide({ voters, plates }: { voters: number; plates: number }) {
  return (
    <div className="rv-rise flex flex-col items-center gap-8">
      <h1><Bi k="verdict" className="font-display text-[110px] leading-none" /></h1>
      {/* Singulier : « 1 bulletin », pas « 1 bulletins ». */}
      <Bi k={voters === 1 ? 'ballotsPlatesOne' : 'ballotsPlates'} v={{ b: voters, p: plates }} className="text-[32px]" />
    </div>
  )
}

// Rangs du bas, groupés : le tableau se remplit par le bas — le dernier d'abord,
// en cascade jusqu'au meilleur d'entre eux, en haut. `rows` : du moins bon au meilleur.
export function BoardSlide({ rows }: { rows: ResultRow[] }) {
  const top = [...rows].reverse()
  const best = top[0]?.position ?? 0
  const worst = top.at(-1)?.position ?? 0
  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-8">
      {/* `a`/`b` diffèrent d'une langue à l'autre (« 9e » / « 9th ») : deux lignes à la main plutôt que <Bi>. */}
      <h1 className="rv-rise flex flex-col items-center font-display leading-none">
        <span className="text-[60px]">{fr('boardRange', { a: ordinal('fr', worst), b: ordinal('fr', best) })}</span>
        <span className="mt-2 text-[34px] italic opacity-70">{en('boardRange', { a: ordinal('en', worst), b: ordinal('en', best) })}</span>
      </h1>
      {/* Colonnes partagées (subgrid) : « N° 20 » est plus large que « N° 9 »,
          les prénoms restent alignés d'une ligne à l'autre. */}
      <ol data-testid="board" className="grid w-full grid-cols-[140px_auto_1fr_auto] gap-x-8 gap-y-3">
        {top.map((r, i) => (
          <li
            key={r.plateId}
            className="rv-rise col-span-4 grid grid-cols-subgrid items-center rounded-[20px] bg-[#fffdf9]/[0.07] px-8 py-3 text-left"
            style={{ animationDelay: `${400 + (top.length - 1 - i) * 550}ms` }}
          >
            <span className="flex flex-col font-display leading-none text-[#d29a55]">
              <span className="text-[52px]">{ordinal('fr', r.position!)}</span>
              <span className="mt-1 text-[20px] italic opacity-60">{ordinal('en', r.position!)}</span>
            </span>
            <PlateTag label={fr('plateTag', { n: r.number })} size="ml" cookie />
            <span className="truncate font-display text-[44px] text-[#7f98e0]">{authorsOf(r)}</span>
            {r.score !== null && <span className="text-[30px] opacity-80">{scoreOf(r)}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

// Un rang (3e, ou rangs du bas quand ils sont peu nombreux) en deux temps :
// l'étiquette et sa note, puis ses auteurs, qui tombent comme un tampon.
export function PlateSlide({ shown, position, podium: onPodium, showAuthors }: { shown: ResultRow[]; position: number; podium: boolean; showAuthors: boolean }) {
  const first = position === 1
  // Ex æquo : chaque nom est repéré par le « N° X » de son assiette.
  const tagOf = (r: ResultRow) => (shown.length > 1 ? `${fr('plateTag', { n: r.number })} · ` : '')
  return (
    <div className="rv-rise flex items-center gap-16">
      <div className="flex flex-col items-center">
        {onPodium ? (
          <>
            <Medal position={position} size={first ? 260 : 220} />
            <span className="text-[36px] italic opacity-60">{ordinal('en', position)}</span>
          </>
        ) : (
          <>
            <span className="font-display text-[180px] leading-none text-[#d29a55]">{ordinal('fr', position)}</span>
            <span className="text-[36px] italic opacity-60">{ordinal('en', position)}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-10">
        {shown.map((r) => (
          <div key={r.plateId} className="flex flex-col items-center gap-4">
            <PlateTag label={fr('plateTag', { n: r.number })} size={first ? 'xl' : 'lg'} tilt cookie score={r.score} scoreLabel={scoreOf(r)} />
            {r.label && <p className="text-[22px] opacity-70">{r.label}</p>}
          </div>
        ))}
      </div>

      {/* Largeur réservée : sans elle, l'arrivée des noms décalait toute la rangée. */}
      <div className="flex min-w-[460px] flex-col items-start gap-4 text-left">
        <Bi k="bakedBy" className="text-[32px]" align="start" />
        {showAuthors ? (
          shown.map((r) => (
            <p key={r.plateId} className="rv-stamp font-display text-[64px] leading-tight text-[#7f98e0]">
              {shown.length > 1 && <span className="text-[28px] opacity-70">{tagOf(r)}</span>}
              {authorsOf(r)}
            </p>
          ))
        ) : (
          <HiddenAuthors />
        )}
      </div>
    </div>
  )
}

function HiddenAuthors({ size = 56 }: { size?: number }) {
  return (
    <div className="rounded-[20px] border-4 border-dashed border-[#f4ebdd]/25 px-10 py-4 opacity-50" style={{ fontSize: size }}>
      <span aria-hidden="true">?</span>
      <span className="sr-only">{fr('authorsHidden')}</span>
    </div>
  )
}

// Duel final : les finalistes arrivent ensemble, chacun de son côté (intro) ; le
// verdict tombe d'un coup — le gagnant se soulève sous sa médaille d'or et les
// miettes jaillissent, le suivant recule (result) ; puis leurs auteurs (authors).
export function DuelSlide({ finalists, stage }: { finalists: ResultRow[]; stage: DuelStage }) {
  const revealed = stage !== 'intro'
  const winners = finalists.filter((r) => r.position === 1).length
  const middle = (finalists.length - 1) / 2
  // Ex æquo en série (1, 2, 2, 2 ou plusieurs 1ers) : à partir de 4 finalistes,
  // tout rétrécit pour tenir sur une TV de 1 920 px (la scène coupe ce qui déborde).
  const many = finalists.length > 3
  const columnWidth = Math.min(540, Math.floor(1760 / finalists.length) - 48)
  const medal = (size: number) => (many ? Math.round(size * 0.7) : size)
  return (
    <div className="flex flex-col items-center gap-10">
      <h1 key={revealed ? 'verdict' : 'intro'} className={revealed ? 'rv-stamp' : 'rv-rise'}>
        {revealed ? (
          <Bi k={winners > 1 ? 'nightCookies' : 'nightCookie'} className="font-display text-[76px] leading-none text-[#f3c787]" />
        ) : (
          <Bi k={finalists.length === 2 ? 'duelTwo' : 'duelMany'} v={{ n: finalists.length }} className="font-display text-[76px] leading-none" />
        )}
      </h1>
      <div className="flex items-start justify-center gap-12">
        {finalists.map((r, i) => {
          const win = r.position === 1
          const enter = i < middle ? 'rv-from-left' : i > middle ? 'rv-from-right' : 'rv-rise'
          return (
            // Colonnes de largeur fixe : l'arrivée d'un nom long ne déplace pas l'autre finaliste.
            <div key={r.plateId} data-testid="finalist" className={`${enter} relative flex flex-col items-center gap-6`} style={{ width: columnWidth }}>
              {/* pb : le gagnant soulevé (rv-win) ne vient pas chevaucher sa médaille. */}
              <div className="flex h-[300px] items-end pb-8">
                {revealed ? (
                  <Medal position={r.position!} size={medal(win ? 200 : 150)} className="rv-medal-drop" />
                ) : (
                  <MysteryMedal size={medal(150)} />
                )}
              </div>
              <div className={revealed ? (win ? 'rv-win' : 'rv-lose') : ''}>
                <PlateTag
                  label={fr('plateTag', { n: r.number })}
                  size={many ? 'ml' : 'xl'}
                  tilt
                  cookie
                  score={revealed ? r.score : null}
                  scoreLabel={revealed ? scoreOf(r) : undefined}
                />
              </div>
              {revealed && win && <Crumbs seed={r.plateId} />}
              <div className="flex min-h-[110px] items-center">
                {stage === 'authors' ? (
                  <p className={`rv-stamp font-display leading-tight text-[#7f98e0] ${many ? 'text-[40px]' : win ? 'text-[72px]' : 'text-[52px]'}`}>{authorsOf(r)}</p>
                ) : (
                  <HiddenAuthors size={44} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FinalSlide({ rows }: { rows: ResultRow[] }) {
  const rest = podium(rows).rest
  // À l'échelle de la soirée (une vingtaine d'assiettes), deux colonnes de
  // grandes lignes débordent de la TV : au-delà de 8, trois colonnes de lignes
  // compactes, numéro et note empilés à droite pour laisser la place aux prénoms.
  const many = rest.length > 8
  // Rempli colonne par colonne : on lit 4e, 5e, 6e… de haut en bas, comme une liste.
  const manyRows = Math.ceil(rest.length / 3)
  return (
    <div className={`rv-rise flex w-full flex-col items-center ${many ? 'gap-5' : 'gap-8'}`}>
      <h1><Bi k="finalRanking" className="font-display text-[56px] leading-none" /></h1>
      <Podium rows={rows} size="tv" text={fr} lang="fr" subLang="en" />
      <ol
        data-testid="final-rest"
        className={`grid w-full text-left ${many ? 'max-w-[1760px] grid-flow-col grid-cols-3 gap-x-4 gap-y-2' : 'max-w-6xl grid-cols-1 gap-3 xl:grid-cols-2'}`}
        style={many ? { gridTemplateRows: `repeat(${manyRows}, auto)` } : undefined}
      >
        {rest.map((r) => (
          <li
            key={r.plateId}
            className={`flex rounded-[18px] bg-[#fffdf9]/10 ${many ? 'items-center gap-3 px-4 py-1.5 text-[18px]' : 'items-baseline gap-4 px-6 py-3 text-[26px]'}`}
          >
            <span className={`flex flex-col font-display leading-none text-[#d29a55] ${many ? 'min-w-20 text-[28px]' : 'min-w-24'}`}>
              {r.position === null ? fr('unranked') : ordinal('fr', r.position)}
              <span className={`mt-1 italic opacity-60 ${many ? 'text-[13px]' : 'text-[16px]'}`}>{r.position === null ? en('unranked') : ordinal('en', r.position)}</span>
            </span>
            {/* Les prénoms d'abord, le numéro d'assiette en second (retours d'UAT). */}
            <span className={`min-w-0 flex-1 font-display text-[#7f98e0] ${many ? 'truncate text-[26px]' : 'text-[34px]'}`}>{authorsOf(r)}</span>
            {many ? (
              <span className="flex flex-col items-end leading-tight opacity-70">
                <span className="font-display text-[16px]">{fr('plateTag', { n: r.number })}</span>
                {r.score !== null && <span>{scoreOf(r)}</span>}
              </span>
            ) : (
              <>
                <span className="font-display text-[20px] opacity-70">{fr('plateTag', { n: r.number })}</span>
                {r.score !== null && <span className="opacity-70">{scoreOf(r)}</span>}
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
