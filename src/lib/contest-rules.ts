// Règles du concours partagées serveur ↔ client. Aucun import Node ici : ce
// module est aussi chargé par les composants client (phases, validation locale).

export const PHASES = ['preparation', 'voting', 'closed', 'reveal'] as const
export type Phase = (typeof PHASES)[number]

export function isPhase(v: unknown): v is Phase {
  return typeof v === 'string' && (PHASES as readonly string[]).includes(v)
}

// L'admin peut reculer d'un cran (spec §3) : rouvrir des votes fermés trop tôt.
export function shiftPhase(p: Phase, dir: 1 | -1): Phase {
  const i = Math.min(PHASES.length - 1, Math.max(0, PHASES.indexOf(p) + dir))
  return PHASES[i]
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ')
  return name.length >= 1 && name.length <= 40 ? name : null
}

export function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const label = raw.trim().replace(/\s+/g, ' ').slice(0, 60)
  return label || null
}

// Les id de concours viennent des colonnes `serial` (int4 Postgres) : un entier
// positif sans zéro initial, borné à 2147483647. Une valeur hors bornes (ex.
// notation exponentielle comme '1e20') ferait planter la requête plutôt que de
// rendre un 404 propre — on la rejette donc avant d'atteindre la base.
const MAX_INT4 = 2147483647

export function parseContestId(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null
  const id = Number(raw)
  return id <= MAX_INT4 ? id : null
}

export function nextPlateNumber(numbers: number[]): number {
  return numbers.length ? Math.max(...numbers) + 1 : 1
}

// Fisher-Yates. `rand` injectable pour des tests déterministes.
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Un bulletin arrive du client : on n'accepte qu'une liste d'identifiants entiers,
// sans doublon, tous dans `allowed` (assiettes du concours hors celles de l'invité).
// Toute anomalie rejette le bulletin entier — pas de réparation silencieuse.
export function checkBallot(raw: unknown, allowed: Set<number>): number[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<number>()
  for (const id of raw) {
    if (!Number.isInteger(id) || !allowed.has(id) || seen.has(id)) return null
    seen.add(id)
  }
  return raw as number[]
}

// Mode de vote (retours d'UAT) : « top K » — seuls les K premiers de chaque
// bulletin rapportent des points — ou « tout » (null). K borné à 1..50.
export const TOP_K_MAX = 50

export function isTopK(v: unknown): v is number | null {
  return v === null || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= TOP_K_MAX)
}
