'use server'

import { claimGuest, findGuestIdByToken, getContestBySecret, loadContestData, replaceBallot, releaseSelf } from '@/lib/contest-db'
import { generateClaimToken, readGuestToken, writeGuestToken, clearGuestToken } from '@/lib/contest-identity'
import { checkBallot } from '@/lib/contest-rules'

type ClaimResult = { ok: true } | { ok: false; error: 'not-found' | 'taken' }
type BallotResult = { ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'closed' | 'invalid' }
type ReleaseResult = { ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'locked' }

// L'invité de ce téléphone, retrouvé par le jeton de son cookie (spec §5) ;
// null si pas de cookie ou jeton libéré entre-temps. Non exporté : dans un
// fichier 'use server', seules les actions le sont.
async function currentGuestId(contestId: number): Promise<number | null> {
  const token = await readGuestToken(contestId)
  return token ? findGuestIdByToken(contestId, token) : null
}

// Le secret du concours tient lieu d'autorisation (spec §5) : sans lui, rien.
export async function claimNameAction(secret: string, guestId: number): Promise<ClaimResult> {
  const contest = await getContestBySecret(secret)
  if (!contest) return { ok: false, error: 'not-found' }
  const token = generateClaimToken()
  if (!(await claimGuest(contest.id, guestId, token))) return { ok: false, error: 'taken' }
  await writeGuestToken(contest.id, token)
  return { ok: true }
}

export async function saveBallotAction(secret: string, plateIds: number[]): Promise<BallotResult> {
  const contest = await getContestBySecret(secret)
  if (!contest) return { ok: false, error: 'not-found' }
  const guestId = await currentGuestId(contest.id)
  if (guestId === null) return { ok: false, error: 'no-identity' }
  if (contest.phase !== 'voting') return { ok: false, error: 'closed' }
  const data = await loadContestData(contest.id)
  // Les assiettes dont l'invité est auteur ne sont pas « autorisées » : un client
  // modifié ne peut pas se classer lui-même.
  const allowed = new Set(data.plates.filter((p) => !p.authorIds.includes(guestId)).map((p) => p.id))
  const ballot = checkBallot(plateIds, allowed)
  if (!ballot) return { ok: false, error: 'invalid' }
  await replaceBallot(guestId, ballot)
  return { ok: true }
}

export async function releaseSelfAction(secret: string): Promise<ReleaseResult> {
  const contest = await getContestBySecret(secret)
  if (!contest) return { ok: false, error: 'not-found' }
  const guestId = await currentGuestId(contest.id)
  if (guestId === null) return { ok: false, error: 'no-identity' }
  if (contest.phase !== 'preparation' && contest.phase !== 'voting') return { ok: false, error: 'locked' }
  await releaseSelf(contest.id, guestId)
  await clearGuestToken(contest.id)
  return { ok: true }
}
