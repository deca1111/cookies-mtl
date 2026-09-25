'use server'

import { requireAdmin } from '@/lib/auth'
import {
  addGuest, addPlate, createContest, deleteContest, deleteGuest, deletePlate, getContestById, isUniqueViolation,
  loadContestData, releaseGuest, renameGuest, setPhase, setPlateNumbers, setRevealStep, updatePlate,
} from '@/lib/contest-db'
import { generateSecret } from '@/lib/contest-identity'
import { cleanLabel, cleanName, nextPlateNumber, shiftPhase, shuffled, type Phase } from '@/lib/contest-rules'
import { loadAdminView } from '@/lib/contest-views'

type AdminResult = { ok: true } | { ok: false; error: string }
const OK = { ok: true } as const

export async function createContestAction(name: string): Promise<{ ok: true; id: number } | { ok: false; error: 'name' }> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  return { ok: true, id: await createContest(clean, generateSecret()) }
}

export async function deleteContestAction(id: number): Promise<AdminResult> {
  await requireAdmin()
  await deleteContest(id)
  return OK
}

export async function addGuestAction(contestId: number, name: string): Promise<AdminResult> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  try {
    await addGuest(contestId, clean)
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'name-taken' }
    throw err
  }
  return OK
}

export async function renameGuestAction(contestId: number, guestId: number, name: string): Promise<AdminResult> {
  await requireAdmin()
  const clean = cleanName(name)
  if (!clean) return { ok: false, error: 'name' }
  try {
    await renameGuest(contestId, guestId, clean)
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'name-taken' }
    throw err
  }
  return OK
}

export async function deleteGuestAction(contestId: number, guestId: number): Promise<AdminResult> {
  await requireAdmin()
  await deleteGuest(contestId, guestId)
  return OK
}

export async function releaseGuestAction(contestId: number, guestId: number): Promise<AdminResult> {
  await requireAdmin()
  await releaseGuest(contestId, guestId)
  return OK
}

type PlateInput = { id?: number; number?: number; label?: string; authorIds: number[] }

export async function savePlateAction(contestId: number, input: PlateInput): Promise<AdminResult> {
  await requireAdmin()
  // `input` vient du client : un tableau forgé (ou absent) planterait `.filter`
  // plus bas plutôt que de rendre une erreur propre.
  if (!Array.isArray(input.authorIds)) return { ok: false, error: 'authors' }
  const label = cleanLabel(input.label)
  const authorIds = input.authorIds.filter(Number.isInteger)
  let number = input.number
  // Renuméroter une assiette existante est réservé à la préparation (spec §9) :
  // hors de cette phase, un numéro modifié côté client — ou forgé côté requête,
  // le champ n'étant verrouillé que dans l'écran — est ignoré, on garde celui
  // déjà en base.
  if (input.id !== undefined) {
    const contest = await getContestById(contestId)
    if (contest && contest.phase !== 'preparation') {
      const { plates } = await loadContestData(contestId)
      const current = plates.find((p) => p.id === input.id)
      if (current) number = current.number
    }
  }
  if (number === undefined) {
    const { plates } = await loadContestData(contestId)
    number = nextPlateNumber(plates.map((p) => p.number))
  }
  if (!Number.isInteger(number) || number < 1) return { ok: false, error: 'number' }
  try {
    if (input.id === undefined) await addPlate(contestId, { number, label, authorIds })
    else await updatePlate(contestId, input.id, { number, label, authorIds })
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'number-taken' }
    throw err
  }
  return OK
}

export async function deletePlateAction(contestId: number, plateId: number): Promise<AdminResult> {
  await requireAdmin()
  await deletePlate(contestId, plateId)
  return OK
}

// Renuméroter pendant les votes désorienterait des invités qui ont déjà classé
// « l'assiette 4 » : le mélange n'existe qu'en préparation (spec §9).
export async function shufflePlatesAction(contestId: number): Promise<AdminResult> {
  await requireAdmin()
  const contest = await getContestById(contestId)
  if (!contest || contest.phase !== 'preparation') return { ok: false, error: 'locked' }
  const { plates } = await loadContestData(contestId)
  const numbers = shuffled(plates.map((p) => p.number))
  await setPlateNumbers(contestId, plates.map((p, i) => ({ plateId: p.id, number: numbers[i] })))
  return OK
}

// `from` porte la phase que l'écran affichait au moment du clic (spec finding #1) :
// les actions serveur sont sérialisées, donc un double clic rapproché sur « Votes
// ouverts → » envoie deux fois la même phase de départ. La première fait avancer
// le concours ; la seconde arrive avec un `from` désormais périmé — on la rejette
// plutôt que de faire sauter une phase (préparation → voting → closed d'un coup).
export async function shiftPhaseAction(contestId: number, from: Phase, dir: 1 | -1): Promise<AdminResult> {
  await requireAdmin()
  const contest = await getContestById(contestId)
  if (!contest) return { ok: false, error: 'not-found' }
  if (contest.phase !== from) return { ok: false, error: 'stale' }
  await setPhase(contestId, shiftPhase(contest.phase, dir))
  return OK
}

export async function setRevealStepAction(contestId: number, step: number): Promise<AdminResult> {
  await requireAdmin()
  // Un `step` non entier (forgé, ou NaN venu d'un champ vide) déborderait les
  // bornes plus bas sans jamais planter — mieux vaut le refuser explicitement.
  if (!Number.isInteger(step)) return { ok: false, error: 'step' }
  const contest = await getContestById(contestId)
  if (!contest || contest.phase !== 'reveal') return { ok: false, error: 'locked' }
  const view = await loadAdminView(contestId)
  if (!view) return { ok: false, error: 'not-found' }
  await setRevealStep(contestId, Math.max(0, Math.min(Math.trunc(step), view.steps.length - 1)))
  return OK
}
