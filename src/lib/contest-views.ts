// Point de passage unique entre la base et ce qu'un écran reçoit : la page
// (rendu initial) et la route de polling appellent la même fonction, donc ne
// peuvent pas diverger sur ce qui est montré.
import { getContestById, getContestBySecret, findGuestIdByToken, loadContestData } from './contest-db'
import { readGuestToken } from './contest-identity'
import { buildAdminView, buildGuestView, type AdminView, type GuestView } from './contest-state'

export async function loadGuestView(secret: string): Promise<GuestView | null> {
  const contest = await getContestBySecret(secret)
  if (!contest) return null
  const token = await readGuestToken(contest.id)
  const [meId, data] = await Promise.all([
    token ? findGuestIdByToken(contest.id, token) : Promise.resolve(null),
    loadContestData(contest.id),
  ])
  return buildGuestView(contest, data, meId)
}

export async function loadAdminView(id: number): Promise<AdminView | null> {
  const contest = await getContestById(id)
  if (!contest) return null
  return buildAdminView(contest, await loadContestData(contest.id))
}
