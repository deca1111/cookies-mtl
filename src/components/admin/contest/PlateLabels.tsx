'use client'

import { IconChevronLeft } from '@/components/icons'

// Étiquettes à poser sur les assiettes (retours d'UAT) : pages US Letter de
// 3 × 3, « cookie N° X » en grand, pointillés pour découper. Imprimer, ou
// « Enregistrer en PDF » depuis la même boîte de dialogue. À l'écran, chaque
// page est un aperçu blanc sur le fond sombre du pilotage ; à l'impression,
// seules les pages sortent, en noir sur blanc.
const PER_PAGE = 9

export function PlateLabels({ contestId, contestName, plates }: { contestId?: number; contestName: string; plates: { number: number }[] }) {
  const numbers = plates.map((p) => p.number).sort((a, b) => a - b)
  const pages = Array.from({ length: Math.ceil(numbers.length / PER_PAGE) }, (_, i) => numbers.slice(i * PER_PAGE, (i + 1) * PER_PAGE))

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-[color:var(--bg)] p-6 print:block print:bg-white print:p-0">
      {/* Format et marges de la feuille : sans `@page`, le navigateur garde ses
          marges par défaut et la grille de 3 × 3 déborde sur une deuxième page. */}
      <style>{'@page { size: letter; margin: 0.4in; }'}</style>
      <div className="flex w-full max-w-[8.5in] flex-wrap items-center gap-3 print:hidden">
        {contestId !== undefined && (
          <a href={`/admin/concours/${contestId}`} className="flex items-center gap-1 text-[13px] text-[color:var(--accent-ink)]">
            <IconChevronLeft size={14} />
            Pilotage
          </a>
        )}
        <h1 className="font-display flex-1 text-[20px] text-[color:var(--text-strong)]">Étiquettes — {contestName}</h1>
        {pages.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-[var(--radius-field)] bg-[color:var(--btn-bg)] px-4 py-2 text-[14px] font-medium text-[color:var(--btn-text)]"
          >
            Imprimer ou enregistrer en PDF
          </button>
        )}
      </div>
      {pages.length === 0 ? (
        <p className="text-[14px] text-[color:var(--text-muted)]">Aucune assiette pour l’instant : ajoute-les dans le pilotage.</p>
      ) : (
        <>
          <p className="max-w-[8.5in] text-[13px] text-[color:var(--text-muted)] print:hidden">
            {numbers.length} étiquette{numbers.length > 1 ? 's' : ''}, {pages.length} page{pages.length > 1 ? 's' : ''} US Letter. Découpe le long des pointillés.
          </p>
          {pages.map((page, i) => (
            <section
              key={i}
              data-testid="label-page"
              className="grid h-[10.2in] w-[7.7in] flex-none grid-cols-3 grid-rows-3 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] print:shadow-none print:[break-after:page] print:last:[break-after:auto]"
            >
              {page.map((n) => (
                <div key={n} className="flex items-center justify-center border border-dashed border-[#b9a993] text-[#2c1f16]">
                  <span data-testid="label" className="flex flex-col items-center gap-[0.15in]">
                    <svg width="72" height="72" viewBox="0 0 300 300" aria-hidden="true">
                      <use href="#cmtl-cookie-full" />
                    </svg>
                    {/* Gill Sans Ultra est très large : à 64 px, « N° 10 » occupe 216 des
                        246 px de la case ; un cran plus petit pour garder une marge. */}
                    <span className={`font-display whitespace-nowrap leading-none ${n >= 10 ? 'text-[56px]' : 'text-[64px]'}`}>N° {n}</span>
                  </span>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </main>
  )
}
