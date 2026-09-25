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
