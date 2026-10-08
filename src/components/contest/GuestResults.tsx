'use client'

import type { ContestMsgKey } from '@/lib/contest-i18n'
import { ordinal, scoreKey } from '@/lib/contest-i18n'
import { podium } from '@/lib/contest-podium'
import type { GuestView, ResultRow } from '@/lib/contest-state'
import type { Lang } from '@/lib/i18n'
import { Podium } from './Podium'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

// Sans point : rien à la place du rang dans la liste (comme sur la scène) ;
// le tableau « ton classement » et « tes cookies » gardent « Au menu », en clair.
function rankLabel(t: T, lang: Lang, position: number | null) {
  return position === null ? t('unranked') : ordinal(lang, position)
}

function Row({ row, t, lang }: { row: ResultRow; t: T; lang: Lang }) {
  return (
    <li data-testid="results-rest-row" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <span className="font-display min-w-10 text-center text-[18px] text-[color:var(--accent-ink)]">{row.position !== null && ordinal(lang, row.position)}</span>
      <div className="flex-1">
        <div className="text-[16px] font-medium text-[color:var(--text-strong)]">
          {t('plate', { n: row.number })}
          {row.authors.length > 0 && <span className="font-normal text-[color:var(--text-body)]"> — {row.authors.join(' & ')}</span>}
        </div>
        {row.score !== null && (
          <div className="text-[13px] text-[color:var(--text-muted)]">
            {/* Top K : le rang moyen ne porterait que sur les citations dans un top,
                trompeur ; les points et le nombre de citations disent l'essentiel. */}
            {t(scoreKey(row.score), { n: row.score })} · {t(row.votes === 1 ? 'votesOne' : 'votes', { n: row.votes })}
          </div>
        )}
      </div>
    </li>
  )
}

export function GuestResults({ results, myBallot, t, lang }: { results: NonNullable<GuestView['results']>; myBallot: number[]; t: T; lang: Lang }) {
  const byId = new Map(results.rows.map((r) => [r.plateId, r]))
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('resultsTitle')}</h1>
        {/* Pyramide des 3 premiers en tête (mêmes règles que la scène), le reste en liste. */}
        <Podium rows={results.rows} size="phone" text={t} lang={lang} />
        <ol className="flex flex-col gap-2">
          {podium(results.rows).rest.map((r) => <Row key={r.plateId} row={r} t={t} lang={lang} />)}
        </ol>
      </section>

      {myBallot.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[22px] text-[color:var(--text-strong)]">{t('yourPalate')}</h2>
          {results.agreement !== null && <p className="text-[15px] text-[color:var(--text-body)]">{t('agreement', { n: results.agreement })}</p>}
          <table className="w-full text-[14px] text-[color:var(--text-body)]">
            <thead>
              <tr className="text-left text-[12px] text-[color:var(--text-muted)]">
                <th className="py-1">{t('yourPick')}</th>
                <th className="py-1">{t('finalRank')}</th>
              </tr>
            </thead>
            <tbody>
              {myBallot.map((id, i) => (
                <tr key={id} className="border-t border-[color:var(--border)]">
                  <td className="py-1.5">{i + 1}. {t('plate', { n: byId.get(id)?.number ?? '?' })}</td>
                  <td className="py-1.5">{rankLabel(t, lang, byId.get(id)?.position ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results.myPlates.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[22px] text-[color:var(--text-strong)]">{t('yourPlates')}</h2>
          {results.myPlates.map((r) => (
            <div key={r.plateId} className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-[14px] text-[color:var(--text-body)]">
              <div className="font-display text-[20px] text-[color:var(--text-strong)]">
                {t('plate', { n: r.number })} — {rankLabel(t, lang, r.position)}
              </div>
              {r.score !== null ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {/* Singulier (point 8 de la vague de correction) : « 1 vote », pas « 1 votes ». */}
                  <li>{t(scoreKey(r.score), { n: r.score })} · {t(r.votes === 1 ? 'votesOne' : 'votes', { n: r.votes })}</li>
                  <li>{t('bestWorst', { best: r.bestRank!, worst: r.worstRank! })}</li>
                  <li>{t('firsts', { n: r.firsts })}</li>
                </ul>
              ) : (
                <p>{t('unranked')}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
