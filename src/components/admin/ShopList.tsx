'use client'

import { useMemo, useState, useTransition } from 'react'
import { setShopInProgressAction } from '@/app/actions/shops'
import { filterInProgress, filterShopsByName } from '@/lib/shop-filter'
import { sortShops, type SortDir } from '@/lib/shop-sort'
import type { Shop } from '@/lib/shops'

type ListSortKey = 'name' | 'rating' | 'recent'

const SORT_LABELS: Record<ListSortKey, string> = {
  recent: 'Récent',
  name: 'Nom',
  rating: 'Note',
}

// Sens d'ouverture de chaque tri : alphabétique croissant, mais meilleure note et
// ajout le plus récent en tête — c'est ce qu'on veut voir en premier.
const SORT_DEFAULT_DIR: Record<ListSortKey, SortDir> = {
  recent: 'desc',
  name: 'asc',
  rating: 'desc',
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
    active
      ? 'border-[color:var(--accent-gold)] bg-[color:var(--accent-gold)] text-[color:var(--accent-gold-ink)]'
      : 'border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--text-body)]'
  }`

export function ShopList({
  shops,
  editingId,
  onEdit,
  onDelete,
}: {
  shops: Shop[]
  editingId?: number
  onEdit: (shop: Shop) => void
  onDelete: (shop: Shop) => void
}) {
  const [sortKey, setSortKey] = useState<ListSortKey>('recent')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [query, setQuery] = useState('')
  const [onlyInProgress, setOnlyInProgress] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const visible = useMemo(
    () => sortShops(filterInProgress(filterShopsByName(shops, query), onlyInProgress), sortKey, sortDir),
    [shops, query, onlyInProgress, sortKey, sortDir]
  )

  const inProgressCount = shops.filter((s) => s.inProgress).length
  const filtered = visible.length !== shops.length

  const pickSort = (k: ListSortKey) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(k)
      setSortDir(SORT_DEFAULT_DIR[k])
    }
  }

  const toggleInProgress = (shop: Shop) => {
    setPendingId(shop.id)
    startTransition(async () => {
      try {
        await setShopInProgressAction(shop.id, !shop.inProgress)
      } catch {
        window.alert('Le changement de statut a échoué — réessaie.')
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Les cookies ({filtered ? `${visible.length} / ${shops.length}` : shops.length})
        </h2>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]"
        >
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12.7 12.7 L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un nom…"
          aria-label="Chercher un cookie par nom"
          className="w-full rounded-[var(--radius-field)] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] py-2.5 pl-10 pr-4 text-[15px] text-[color:var(--text-strong)] placeholder:text-[color:var(--text-muted)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['recent', 'name', 'rating'] as const).map((k) => (
          <button
            key={k}
            onClick={() => pickSort(k)}
            aria-pressed={sortKey === k}
            className={chip(sortKey === k)}
          >
            {SORT_LABELS[k]}
            {sortKey === k && (
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                aria-hidden="true"
                className={sortDir === 'asc' ? 'rotate-180' : ''}
              >
                <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </button>
        ))}
        {/* Pas de séparateur vertical entre les tris et ce filtre : à 390 px la
            barre passe sur deux lignes et le trait restait orphelin en bout de
            ligne. Le libellé chiffré suffit à le distinguer des tris. */}
        <button
          onClick={() => setOnlyInProgress((v) => !v)}
          aria-pressed={onlyInProgress}
          className={chip(onlyInProgress)}
        >
          En cours ({inProgressCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-3 text-[14px] text-[color:var(--text-muted)]">
          {shops.length === 0 ? 'Aucun cookie pour l’instant.' : 'Aucun cookie ne correspond.'}
        </p>
      ) : (
        <ul className="-my-1 divide-y divide-[color:var(--border)]">
          {visible.map((shop) => (
            <li
              key={shop.id}
              data-editing={editingId === shop.id || undefined}
              className="flex items-center justify-between gap-4 py-3 data-[editing]:-mx-2 data-[editing]:rounded-lg data-[editing]:border-l-2 data-[editing]:border-[color:var(--accent)] data-[editing]:bg-[color:var(--accent-wash)] data-[editing]:px-2"
            >
              <div className="min-w-0">
                <span className="font-display block truncate text-[17px] text-[color:var(--text-strong)]">
                  {shop.name}
                </span>
                <span className="flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
                  {String(shop.rating).replace('.', ',')} / 5
                  {/* La pastille de statut EST la bascule : une troisième action dans
                      la colonne de droite y tenait sur une 3e ligne à 390 px et rognait
                      le nom. Ici elle occupe la place libre sous le titre, et l'état
                      se lit sans avoir à déchiffrer un libellé d'action. */}
                  <button
                    onClick={() => toggleInProgress(shop)}
                    disabled={pendingId === shop.id}
                    aria-pressed={shop.inProgress}
                    title={
                      shop.inProgress
                        ? 'Publier — remettre sur la carte publique'
                        : 'Passer en cours — retirer de la carte publique'
                    }
                    // « Publié » est l'état normal de 51 fiches sur 51 : sans cadre, il
                    // s'efface (le contour ne revient qu'au survol) et seul « En cours »,
                    // l'exception qu'on cherche du regard, porte la pastille dorée.
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${
                      shop.inProgress
                        ? 'border-[color:var(--accent-gold)] bg-[color:var(--accent-gold)] text-[color:var(--accent-gold-ink)]'
                        : 'border-transparent hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-body)]'
                    }`}
                  >
                    <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2 w-2">
                      <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      {shop.inProgress && <circle cx="5" cy="5" r="2" fill="currentColor" />}
                    </svg>
                    {shop.inProgress ? 'En cours' : 'Publié'}
                  </button>
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-[13px] sm:flex-row sm:items-center sm:gap-3">
                <button
                  onClick={() => onEdit(shop)}
                  className="text-[color:var(--text-body)] underline underline-offset-4 transition-colors hover:text-[color:var(--accent-ink)]"
                >
                  Modifier
                </button>
                <button
                  onClick={() => onDelete(shop)}
                  className="text-[color:var(--danger)] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
