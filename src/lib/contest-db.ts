// Accès base du concours. Jamais de 'use cache' ici : l'état change à chaque vote
// et chaque écran le relit toutes les 2,5 s. Toute écriture est bornée à son
// concours (contest_id dans le WHERE) : un identifiant forgé ne traverse pas.
import { getSql } from './db'
import { isPhase, type Phase } from './contest-rules'
import type { Contest, ContestData } from './contest-state'

export type ContestSummary = { id: number; name: string; phase: Phase; guestCount: number; createdAt: string }

type ContestRecord = { id: number; name: string; secret: string; phase: string; reveal_step: number }

function toContest(r: ContestRecord): Contest {
  return { id: r.id, name: r.name, secret: r.secret, phase: isPhase(r.phase) ? r.phase : 'preparation', revealStep: r.reveal_step }
}

// Code Postgres d'une violation d'unicité (nom d'invité ou numéro d'assiette pris).
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

export async function listContests(): Promise<ContestSummary[]> {
  const rows = (await getSql()`
    SELECT c.id, c.name, c.phase, c.created_at, count(g.id)::int AS guest_count
    FROM contests c LEFT JOIN contest_guests g ON g.contest_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `) as { id: number; name: string; phase: string; created_at: string | Date; guest_count: number }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phase: isPhase(r.phase) ? r.phase : 'preparation',
    guestCount: r.guest_count,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}

export async function createContest(name: string, secret: string): Promise<number> {
  const rows = (await getSql()`INSERT INTO contests (name, secret) VALUES (${name}, ${secret}) RETURNING id`) as { id: number }[]
  return rows[0].id
}

export async function deleteContest(id: number): Promise<void> {
  await getSql()`DELETE FROM contests WHERE id = ${id}`
}

export async function renameContest(id: number, name: string): Promise<boolean> {
  const rows = (await getSql()`
    UPDATE contests SET name = ${name}, updated_at = now() WHERE id = ${id} RETURNING id
  `) as { id: number }[]
  return rows.length === 1
}

export async function getContestById(id: number): Promise<Contest | null> {
  const rows = (await getSql()`SELECT id, name, secret, phase, reveal_step FROM contests WHERE id = ${id}`) as ContestRecord[]
  return rows[0] ? toContest(rows[0]) : null
}

export async function getContestBySecret(secret: string): Promise<Contest | null> {
  const rows = (await getSql()`SELECT id, name, secret, phase, reveal_step FROM contests WHERE secret = ${secret}`) as ContestRecord[]
  return rows[0] ? toContest(rows[0]) : null
}

export async function setPhase(id: number, phase: Phase): Promise<void> {
  // Revenir avant la révélation remet la scène au début : sinon un aller-retour
  // de phase laisserait les téléphones sur l'écran final.
  await getSql()`
    UPDATE contests SET phase = ${phase}, updated_at = now(),
      reveal_step = CASE WHEN ${phase}::text = 'reveal' THEN reveal_step ELSE 0 END
    WHERE id = ${id}
  `
}

export async function setRevealStep(id: number, step: number): Promise<void> {
  await getSql()`UPDATE contests SET reveal_step = ${step}, updated_at = now() WHERE id = ${id}`
}

export async function addGuest(contestId: number, name: string): Promise<void> {
  await getSql()`INSERT INTO contest_guests (contest_id, name) VALUES (${contestId}, ${name})`
}

export async function renameGuest(contestId: number, guestId: number, name: string): Promise<void> {
  await getSql()`UPDATE contest_guests SET name = ${name} WHERE id = ${guestId} AND contest_id = ${contestId}`
}

export async function deleteGuest(contestId: number, guestId: number): Promise<void> {
  await getSql()`DELETE FROM contest_guests WHERE id = ${guestId} AND contest_id = ${contestId}`
}

// Libérer un nom — par l'admin ou par l'invité qui s'est trompé (spec PR 2 §5) —
// efface aussi son bulletin, en une transaction : fait sous ce nom, il fausserait
// le classement et le prochain à prendre le nom en hériterait.
export async function releaseGuest(contestId: number, guestId: number): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`DELETE FROM contest_ballots WHERE guest_id = ${guestId}
        AND guest_id IN (SELECT id FROM contest_guests WHERE contest_id = ${contestId})`,
    sql`UPDATE contest_guests SET claim_token = NULL WHERE id = ${guestId} AND contest_id = ${contestId}`,
  ])
}

// Atomique : deux téléphones qui choisissent le même nom au même instant, un
// seul gagne (la condition `claim_token IS NULL` est évaluée par la mise à jour).
export async function claimGuest(contestId: number, guestId: number, token: string): Promise<boolean> {
  const rows = (await getSql()`
    UPDATE contest_guests SET claim_token = ${token}
    WHERE id = ${guestId} AND contest_id = ${contestId} AND claim_token IS NULL
    RETURNING id
  `) as { id: number }[]
  return rows.length === 1
}

export async function findGuestIdByToken(contestId: number, token: string): Promise<number | null> {
  const rows = (await getSql()`
    SELECT id FROM contest_guests WHERE contest_id = ${contestId} AND claim_token = ${token}
  `) as { id: number }[]
  return rows[0]?.id ?? null
}

type PlateInput = { number: number; label: string | null; authorIds: number[] }

export async function addPlate(contestId: number, p: PlateInput): Promise<void> {
  const sql = getSql()
  // CTE unique : l'assiette et ses auteurs naissent ensemble ou pas du tout.
  // Les auteurs sont filtrés sur les invités DE CE concours.
  await sql`
    WITH plate AS (
      INSERT INTO contest_plates (contest_id, number, label) VALUES (${contestId}, ${p.number}, ${p.label}) RETURNING id
    )
    INSERT INTO contest_plate_authors (plate_id, guest_id)
    SELECT plate.id, g.id FROM plate, contest_guests g
    WHERE g.contest_id = ${contestId} AND g.id = ANY(${p.authorIds}::int[])
  `
}

export async function updatePlate(contestId: number, plateId: number, p: PlateInput): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`UPDATE contest_plates SET number = ${p.number}, label = ${p.label} WHERE id = ${plateId} AND contest_id = ${contestId}`,
    sql`DELETE FROM contest_plate_authors WHERE plate_id = ${plateId}
        AND plate_id IN (SELECT id FROM contest_plates WHERE contest_id = ${contestId})`,
    sql`INSERT INTO contest_plate_authors (plate_id, guest_id)
        SELECT p.id, g.id FROM contest_plates p, contest_guests g
        WHERE p.id = ${plateId} AND p.contest_id = ${contestId}
          AND g.contest_id = ${contestId} AND g.id = ANY(${p.authorIds}::int[])`,
    // Un invité devenu auteur ne classe plus cette assiette (spec §11). On relit les
    // auteurs qui viennent d'être insérés (et non `p.authorIds` brut) pour rester
    // borné à ce concours : un identifiant d'invité forgé, hors concours, ne
    // supprimerait alors aucun bulletin étranger.
    sql`DELETE FROM contest_ballots WHERE plate_id = ${plateId}
        AND guest_id IN (
          SELECT a.guest_id FROM contest_plate_authors a JOIN contest_plates p ON p.id = a.plate_id
          WHERE a.plate_id = ${plateId} AND p.contest_id = ${contestId}
        )`,
  ])
}

export async function deletePlate(contestId: number, plateId: number): Promise<void> {
  await getSql()`DELETE FROM contest_plates WHERE id = ${plateId} AND contest_id = ${contestId}`
}

export async function setPlateNumbers(contestId: number, pairs: { plateId: number; number: number }[]): Promise<void> {
  const ids = pairs.map((p) => p.plateId)
  const numbers = pairs.map((p) => p.number)
  await getSql()`
    UPDATE contest_plates p SET number = m.number
    FROM unnest(${ids}::int[], ${numbers}::int[]) AS m(id, number)
    WHERE p.id = m.id AND p.contest_id = ${contestId}
  `
}

// Le bulletin est remplacé en entier, en une transaction : le client envoie
// toujours la liste complète, jamais un différentiel (pas de conflit possible).
export async function replaceBallot(guestId: number, plateIds: number[]): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`DELETE FROM contest_ballots WHERE guest_id = ${guestId}`,
    sql`INSERT INTO contest_ballots (guest_id, plate_id, rank)
        SELECT ${guestId}, t.plate_id, t.rank
        FROM unnest(${plateIds}::int[]) WITH ORDINALITY AS t(plate_id, rank)`,
  ])
}

export async function loadContestData(contestId: number): Promise<ContestData> {
  const sql = getSql()
  const [guests, plates, ballots] = await Promise.all([
    sql`SELECT id, name, claim_token IS NOT NULL AS claimed FROM contest_guests
        WHERE contest_id = ${contestId} ORDER BY lower(name)` as unknown as Promise<{ id: number; name: string; claimed: boolean }[]>,
    sql`SELECT p.id, p.number, p.label,
          coalesce(array_agg(a.guest_id) FILTER (WHERE a.guest_id IS NOT NULL), '{}') AS author_ids
        FROM contest_plates p LEFT JOIN contest_plate_authors a ON a.plate_id = p.id
        WHERE p.contest_id = ${contestId} GROUP BY p.id ORDER BY p.number` as unknown as Promise<
      { id: number; number: number; label: string | null; author_ids: number[] }[]
    >,
    sql`SELECT b.guest_id, array_agg(b.plate_id ORDER BY b.rank) AS plate_ids
        FROM contest_ballots b JOIN contest_guests g ON g.id = b.guest_id
        WHERE g.contest_id = ${contestId} GROUP BY b.guest_id` as unknown as Promise<{ guest_id: number; plate_ids: number[] }[]>,
  ])
  return {
    guests,
    plates: plates.map((p) => ({ id: p.id, number: p.number, label: p.label, authorIds: p.author_ids })),
    ballots: ballots.map((b) => ({ guestId: b.guest_id, plateIds: b.plate_ids })),
  }
}
