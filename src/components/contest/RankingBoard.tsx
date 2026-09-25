'use client'

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { IconCheck, IconClose } from '@/components/icons'
import type { ContestMsgKey } from '@/lib/contest-i18n'
import { moveBy, placeAt, removeFrom } from '@/lib/contest-ranking'

type Plate = { id: number; number: number; label: string | null }
type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

type Props = { plates: Plate[]; ranking: number[]; onChange: (next: number[]) => void; locked: boolean; t: T }

export function RankingBoard({ plates, ranking, onChange, locked, t }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const byId = new Map(plates.map((p) => [p.id, p]))
  // Une assiette supprimée par l'admin disparaît d'elle-même (spec §11).
  const ranked = ranking.filter((id) => byId.has(id))
  const pool = plates.filter((p) => !ranked.includes(p.id))

  // Appui long de 200 ms avant de saisir une ligne au doigt : sans ce délai, le
  // simple défilement de la page déclencherait des glisser involontaires.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onChange(arrayMove(ranked, ranked.indexOf(Number(active.id)), ranked.indexOf(Number(over.id))))
  }

  const place = (index: number) => {
    if (picked === null) return
    onChange(placeAt(ranked, picked, index))
    setPicked(null)
  }

  const slot = (index: number) =>
    picked !== null && (
      <button
        key={`slot-${index}`}
        type="button"
        onClick={() => place(index)}
        className="w-full rounded-[var(--radius-field)] border-2 border-dashed border-[color:var(--accent)] py-2 text-[14px] font-medium text-[color:var(--accent-ink)]"
      >
        {t('placeHere')}
      </button>
    )

  return (
    <div className="flex flex-col gap-6">
      {!locked && pool.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('toTaste')}</h2>
          <p className="text-[13px] text-[color:var(--text-muted)]">{t('toTasteHint')}</p>
          <div className="flex flex-wrap gap-2">
            {pool.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={picked === p.id}
                onClick={() => setPicked(picked === p.id ? null : p.id)}
                className={`rounded-full border px-4 py-2 text-[15px] ${
                  picked === p.id
                    ? 'border-[color:var(--accent)] bg-[color:var(--btn-bg)] text-[color:var(--btn-text)]'
                    : 'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--text-strong)]'
                }`}
              >
                {t('plate', { n: p.number })}
              </button>
            ))}
          </div>
          {picked !== null && (
            <button type="button" onClick={() => setPicked(null)} className="self-start text-[13px] text-[color:var(--text-muted)] underline">
              {t('cancelPlace')}
            </button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('myRanking')}</h2>
        {ranked.length === 0 && picked === null && (
          <p className="rounded-[var(--radius-card)] border border-dashed border-[color:var(--border-strong)] p-4 text-[14px] text-[color:var(--text-muted)]">
            {t('emptyRanking')}
          </p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2">
              {slot(0)}
              {ranked.map((id, i) => (
                <li key={id} className="flex flex-col gap-2">
                  <RankedRow
                    plate={byId.get(id)!}
                    index={i}
                    count={ranked.length}
                    locked={locked}
                    t={t}
                    onUp={() => onChange(moveBy(ranked, id, -1))}
                    onDown={() => onChange(moveBy(ranked, id, 1))}
                    onRemove={() => onChange(removeFrom(ranked, id))}
                  />
                  {slot(i + 1)}
                </li>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </section>

      {!locked && (
        <p className="flex items-center gap-2 text-[14px] text-[color:var(--text-body)]">
          {pool.length === 0 ? (
            <>
              <IconCheck size={16} />
              {t('allRanked')}
            </>
          ) : (
            t('platesLeft', { n: pool.length })
          )}
        </p>
      )}
    </div>
  )
}

type RowProps = {
  plate: Plate; index: number; count: number; locked: boolean; t: T
  onUp: () => void; onDown: () => void; onRemove: () => void
}

function RankedRow({ plate, index, count, locked, t, onUp, onDown, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plate.id, disabled: locked })
  const btn = 'rounded-full px-2.5 py-1.5 text-[13px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)] disabled:opacity-30'
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-chip)] ${isDragging ? 'relative z-10 opacity-90' : ''}`}
    >
      <span className="font-display w-8 text-center text-[20px] text-[color:var(--accent-ink)]">{index + 1}</span>
      <div {...attributes} {...listeners} className="flex-1 touch-none select-none">
        <div className="text-[16px] font-medium text-[color:var(--text-strong)]">{t('plate', { n: plate.number })}</div>
        {plate.label && <div className="text-[13px] text-[color:var(--text-muted)]">{plate.label}</div>}
      </div>
      {!locked && (
        <div className="flex items-center">
          <button type="button" aria-label={t('moveUp')} onClick={onUp} disabled={index === 0} className={btn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
          <button type="button" aria-label={t('moveDown')} onClick={onDown} disabled={index === count - 1} className={btn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <button type="button" aria-label={t('remove')} onClick={onRemove} className={btn}>
            <IconClose size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
