'use client'

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, rectIntersection, useDraggable, useDroppable,
  useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent, type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type ReactNode } from 'react'
import { IconCheck, IconClose, IconPlate } from '@/components/icons'
import type { ContestMsgKey } from '@/lib/contest-i18n'
import { dropIndex, moveBy, placeAt, removeFrom } from '@/lib/contest-ranking'
import { PlateTag } from './PlateTag'

type Plate = { id: number; number: number; label: string | null }
type T = (k: ContestMsgKey, vars?: Record<string, string | number>) => string

type Props = { plates: Plate[]; ranking: number[]; onChange: (next: number[]) => void; locked: boolean; t: T }

// Les assiettes « à goûter » se glissent aussi dans le classement : ce sont des
// draggables du même DndContext, à l'id préfixé pour ne pas les confondre avec
// les lignes classées (ids numériques). La zone du classement est un droppable,
// pour accueillir la première assiette d'une liste encore vide.
const POOL = 'pool-'
const ZONE = 'ranking'
const poolPlateId = (id: UniqueIdentifier) => (typeof id === 'string' && id.startsWith(POOL) ? Number(id.slice(POOL.length)) : null)

// Une ligne classée qu'on déplace vise la ligne la plus proche, comme avant.
// Une assiette venue d'« à goûter » ne vise rien tant qu'elle ne touche pas la
// zone du classement : la relâcher ailleurs la laisse où elle était.
const collision: CollisionDetection = (args) => {
  const rows = args.droppableContainers.filter((c) => c.id !== ZONE)
  if (poolPlateId(args.active.id) === null) return closestCenter({ ...args, droppableContainers: rows })
  const zone = rectIntersection({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.id === ZONE) })
  if (zone.length === 0) return []
  const hits = closestCenter({ ...args, droppableContainers: rows })
  return hits.length > 0 ? hits : zone
}

export function RankingBoard({ plates, ranking, onChange, locked, t }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  // Glisser depuis « à goûter » : l'assiette tenue, et où elle tomberait.
  const [dragged, setDragged] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const byId = new Map(plates.map((p) => [p.id, p]))
  // Une assiette supprimée par l'admin disparaît d'elle-même (spec §11).
  const ranked = ranking.filter((id) => byId.has(id))
  const pool = plates.filter((p) => !ranked.includes(p.id))
  // Si l'admin supprime l'assiette choisie entre les deux appuis (assiette,
  // puis emplacement), `picked` pointe vers un id qui n'est plus à goûter :
  // on l'ignore pour l'affichage plutôt que d'envoyer un classement invalide.
  const activePick = picked !== null && pool.some((p) => p.id === picked) ? picked : null

  // Appui long de 200 ms avant de saisir une ligne au doigt : sans ce délai, le
  // simple défilement de la page déclencherait des glisser involontaires.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Avant ou après la ligne survolée, selon que le centre de l'assiette tenue a
  // passé celui de la ligne ; null hors de la zone du classement.
  const poolTarget = ({ active, over }: DragMoveEvent | DragEndEvent): number | null => {
    if (!over) return null
    const held = active.rect.current.translated
    const below = !!held && held.top + held.height / 2 > over.rect.top + over.rect.height / 2
    return dropIndex(ranked, over.id === ZONE ? null : Number(over.id), below)
  }

  const resetDrag = () => {
    setDragged(null)
    setDropAt(null)
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragged(poolPlateId(active.id))
    setPicked(null)
  }

  const onDragMove = (event: DragMoveEvent) => {
    if (poolPlateId(event.active.id) !== null) setDropAt(poolTarget(event))
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const fromPool = poolPlateId(active.id)
    resetDrag()
    if (fromPool !== null) {
      const index = poolTarget(event)
      if (index !== null) onChange(placeAt(ranked, fromPool, index))
      return
    }
    if (!over || active.id === over.id) return
    onChange(arrayMove(ranked, ranked.indexOf(Number(active.id)), ranked.indexOf(Number(over.id))))
  }

  const place = (index: number) => {
    if (activePick === null) return
    onChange(placeAt(ranked, activePick, index))
    setPicked(null)
  }

  const slot = (index: number) =>
    activePick !== null && (
      <button
        key={`slot-${index}`}
        type="button"
        onClick={() => place(index)}
        className="w-full rounded-[var(--radius-field)] border-2 border-dashed border-[color:var(--accent)] py-2 text-[14px] font-medium text-[color:var(--accent-ink)]"
      >
        {t('placeHere')}
      </button>
    )
  const firstSlot = slot(0)

  const draggedPlate = dragged !== null ? byId.get(dragged) : undefined
  // Trait d'insertion plutôt qu'une case qui pousserait les lignes : la liste
  // sauterait sous le doigt à chaque changement de cible.
  const dropLine = (edge: 'top' | 'bottom') => (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 h-[3px] rounded-full bg-[color:var(--accent)] ${edge === 'top' ? '-top-[5px]' : '-bottom-[5px]'}`}
    />
  )

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={resetDrag}>
      <div className="flex flex-col gap-6">
        {!locked && pool.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('toTaste')}</h2>
            <p className="text-[13px] text-[color:var(--text-muted)]">{t('toTasteHint')}</p>
            <div className="flex flex-wrap gap-2">
              {pool.map((p) => (
                <PoolChip key={p.id} plate={p} picked={activePick === p.id} onPick={() => setPicked(picked === p.id ? null : p.id)} t={t} />
              ))}
            </div>
            {activePick !== null && (
              <button type="button" onClick={() => setPicked(null)} className="self-start text-[13px] text-[color:var(--text-muted)] underline">
                {t('cancelPlace')}
              </button>
            )}
          </section>
        )}

        <RankingZone disabled={locked}>
          <h2 className="font-display text-[20px] text-[color:var(--text-strong)]">{t('myRanking')}</h2>
          {ranked.length === 0 && activePick === null && (
            <p
              className={`rounded-[var(--radius-card)] border-dashed p-4 text-[14px] text-[color:var(--text-muted)] ${dropAt === 0
                ? 'border-2 border-[color:var(--accent)]'
                : 'border border-[color:var(--border-strong)]'}`}
            >
              {t('emptyRanking')}
            </p>
          )}
          <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2">
              {/* `slot` peut ne rien rendre (aucune assiette choisie) : on l'enveloppe
                  ici dans un <li>, sinon c'est un <button> en enfant direct de <ol> —
                  balisage de liste invalide. Les emplacements entre deux assiettes
                  classées restent dans le <li> de leur ligne, plus bas. */}
              {firstSlot && <li>{firstSlot}</li>}
              {ranked.map((id, i) => (
                <li key={id} className="relative flex flex-col gap-2">
                  {dropAt === i && dropLine('top')}
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
                  {i === ranked.length - 1 && dropAt === ranked.length && dropLine('bottom')}
                </li>
              ))}
            </ol>
          </SortableContext>
        </RankingZone>

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
      {/* L'assiette suit le doigt dans une couche à part : déplacée sur place,
          elle passerait sous la section du classement. */}
      <DragOverlay dropAnimation={null}>
        {draggedPlate && <PlateTag label={t('plateTag', { n: draggedPlate.number })} size="md" />}
      </DragOverlay>
    </DndContext>
  )
}

function RankingZone({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: ZONE, disabled })
  return (
    <section ref={setNodeRef} className="flex flex-col gap-2">
      {children}
    </section>
  )
}

type ChipProps = { plate: Plate; picked: boolean; onPick: () => void; t: T }

function PoolChip({ plate, picked, onPick, t }: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${POOL}${plate.id}` })
  // Au clavier, Entrée/Espace gardent « choisir puis placer » : sans ce retrait,
  // le KeyboardSensor les intercepterait pour démarrer un glisser.
  const pointer = { ...listeners }
  delete pointer.onKeyDown
  // Pas de `touch-none` ici (même raison que la poignée des lignes, plus bas) :
  // l'appui long du TouchSensor suffit à distinguer le glisser du défilement.
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...pointer}
      aria-pressed={picked}
      aria-label={t('plate', { n: plate.number })}
      onClick={onPick}
      className={`select-none rounded-[10px] [-webkit-touch-callout:none] ${picked ? 'ring-4 ring-[color:var(--btn-bg)]' : ''} ${isDragging ? 'opacity-40' : ''}`}
    >
      <PlateTag label={t('plateTag', { n: plate.number })} size="md" />
    </button>
  )
}

type RowProps = {
  plate: Plate; index: number; count: number; locked: boolean; t: T
  onUp: () => void; onDown: () => void; onRemove: () => void
}

function RankedRow({ plate, index, count, locked, t, onUp, onDown, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: plate.id,
    disabled: locked,
  })
  const btn = 'rounded-full px-2.5 py-1.5 text-[13px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)] disabled:opacity-30'
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-chip)] ${isDragging ? 'relative z-10 opacity-90' : ''}`}
    >
      {/* Poignée dédiée : `attributes`/`listeners` (et donc `touch-none`) ne
          portent que sur ce petit bouton, pas sur toute la ligne. Sinon un doigt
          qui balaie le nom de l'assiette ne peut plus faire défiler la page sur
          iOS — `touch-action: none` gagne avant que le délai du TouchSensor
          rende la main au défilement. */}
      {!locked && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('dragHandle')}
          className="flex-none touch-none cursor-grab rounded-full p-1.5 text-[color:var(--text-muted)] active:cursor-grabbing"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" />
          </svg>
        </button>
      )}
      <span className="font-display w-8 text-center text-[22px] text-[color:var(--btn-bg)]">{index + 1}</span>
      {/* Le rang, puis l'assiette : son icône et son étiquette suffisent, sans
          « Assiette X » en toutes lettres qui ajoutait un troisième chiffre. */}
      <span className="flex-none text-[color:var(--text-muted)]"><IconPlate size={24} /></span>
      <PlateTag label={t('plateTag', { n: plate.number })} size="sm" tilt />
      <div className="flex-1 select-none">
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
