'use client'

import type { ContestMsgKey } from '@/lib/contest-i18n'
import type { GuestView, ResultRow } from '@/lib/contest-state'

type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

function rankLabel(t: T, position: number | null) {
  if (position === null) return t('unranked')
  return position === 1 ? t('firstRank') : t('rank', { n: position })
}

function Row({ row, t }: { row: ResultRow; t: T }) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <span className="font-display w-10 text-center text-[18px] text-[color:var(--accent-ink)]">{rankLabel(t, row.position)}</span>
      <div className="flex-1">
        <div className="text-[16px] font-medium text-[color:var(--text-strong)]">
          {t('plate', { n: row.number })}
          {row.authors.length > 0 && <span className="font-normal text-[color:var(--text-body)]"> — {row.authors.join(' & ')}</span>}
        </div>
        {row.score !== null && (
          <div className="text-[13px] text-[color:var(--text-muted)]">
            {t('score', { n: row.score })} · {t('avgRank', { n: row.avgRank!.toFixed(1) })}
          </div>
        )}
      </div>
    </li>
  )
}

export function GuestResults({ results, myBallot, t }: { results: NonNullable<GuestView['results']>; myBallot: number[]; t: T }) {
  const byId = new Map(results.rows.map((r) => [r.plateId, r]))
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] text-[color:var(--text-strong)]">{t('resultsTitle')}</h1>
        <ol className="flex flex-col gap-2">
          {results.rows.map((r) => <Row key={r.plateId} row={r} t={t} />)}
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
                  <td className="py-1.5">{rankLabel(t, byId.get(id)?.position ?? null)}</td>
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
                {t('plate', { n: r.number })} — {rankLabel(t, r.position)}
              </div>
              {r.score !== null ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  <li>{t('score', { n: r.score })} · {t('votes', { n: r.votes })}</li>
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
