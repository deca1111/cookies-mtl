'use server'

import { claimGuest, findGuestIdByToken, getContestBySecret, loadContestData, replaceBallot } from '@/lib/contest-db'
import { generateClaimToken, readGuestToken, writeGuestToken } from '@/lib/contest-identity'
import { checkBallot } from '@/lib/contest-rules'

type ClaimResult = { ok: true } | { ok: false; error: 'not-found' | 'taken' }
type BallotResult = { ok: true } | { ok: false; error: 'not-found' | 'no-identity' | 'closed' | 'invalid' }

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
  const token = await readGuestToken(contest.id)
  const guestId = token ? await findGuestIdByToken(contest.id, token) : null
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
