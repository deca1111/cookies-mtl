import type { ContestMsgKey } from '@/lib/contest-i18n'
import { ordinal } from '@/lib/contest-i18n'
import { podium } from '@/lib/contest-podium'
import type { ResultRow } from '@/lib/contest-state'
import type { Lang } from '@/lib/i18n'
import { Medal } from './Medal'
import { PlateTag } from './PlateTag'

type Text = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

// Pyramide des 3 premiers (spec PR 2 §6-7) : 2e à gauche, 1er au centre et
// plus haut, 3e à droite. Marche vide (ex æquo au-dessus) : non rendue.
// Couleurs : la TV reste sombre quel que soit le thème (dorés et bleu fixes) ;
// sur téléphone, le thème clair rendrait ces teintes illisibles, d'où les jetons.
// `subLang` (spec §6 : toujours FR + EN sur la scène) : quand fourni, affiche
// sous chaque rang l'ordinal dans cette langue, en petit et estompé — la scène
// est la seule à le passer (`GuestResults`, en phone, reste dans la langue de
// l'invité, sans doublon).
export function Podium({ rows, size, text, lang, subLang }: { rows: ResultRow[]; size: 'phone' | 'tv'; text: Text; lang: Lang; subLang?: Lang }) {
  const p = podium(rows)
  const tv = size === 'tv'
  const steps = [
    { position: 2, rows: p.second, lift: tv ? 'pt-16' : 'pt-6' },
    { position: 1, rows: p.first, lift: 'pt-0' },
    { position: 3, rows: p.third, lift: tv ? 'pt-24' : 'pt-10' },
  ].filter((s) => s.rows.length > 0)

  // Rang écrit sur téléphone ; la TV affiche une médaille à la place.
  const rankClass = (position: number) => (position === 1 ? 'text-[36px] text-[color:var(--accent-ink)]' : 'text-[28px] text-[color:var(--accent-ink)]')
  // Sur la TV, les prénoms priment sur le numéro d'assiette (retours d'UAT) :
  // grands sous une étiquette plus petite, encore plus grands pour le 1er.
  const authorsClass = (position: number) =>
    tv ? `${position === 1 ? 'text-[64px]' : 'text-[48px]'} leading-tight text-[#7f98e0]` : 'text-[14px] text-[color:var(--phase-reveal)]'

  return (
    <div className={`flex items-start justify-center ${tv ? 'gap-12' : 'gap-4'}`}>
      {steps.map((s) => (
        <div key={s.position} data-testid="podium-step" data-position={s.position} className={`flex flex-col items-center gap-2 ${s.lift}`}>
          {/* Sur la TV, une médaille par marche (retours d'UAT) : le podium se distingue
              du reste du classement, qui garde un simple chiffre. */}
          {tv ? (
            <Medal position={s.position} size={s.position === 1 ? 120 : 96} />
          ) : (
            <span className={`font-display leading-none ${rankClass(s.position)}`}>{ordinal(lang, s.position)}</span>
          )}
          {subLang && (
            <span className={`italic opacity-70 ${tv ? 'text-[32px]' : 'text-[0.45em]'}`}>{ordinal(subLang, s.position)}</span>
          )}
          <div className={`flex ${tv ? 'gap-6' : 'gap-2'}`}>
            {s.rows.map((r) => (
              <div key={r.plateId} className="flex flex-col items-center gap-1 text-center">
                <PlateTag label={text('plateTag', { n: r.number })} size={tv ? 'ml' : 'sm'} tilt score={r.score} scoreLabel={r.score === null ? undefined : text('score', { n: r.score })} />
                <span className={`font-display ${authorsClass(s.position)}`}>{r.authors.join(' & ') || '?'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
