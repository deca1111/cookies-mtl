// Étiquette d'assiette crème (spec PR 2 §6-7), la même sur la scène et sur les
// téléphones : « N° X » en grand, jamais d'icône. Couleurs fixes (crème et
// chocolat) quel que soit le thème : c'est un objet, comme l'étiquette posée
// sur la table.
const SIZES = {
  sm: { box: 'min-w-[44px] px-2 py-1.5 rounded-[8px]', num: 'text-[15px]', score: 'text-[10px]' },
  md: { box: 'min-w-[64px] px-3 py-2 rounded-[10px]', num: 'text-[20px]', score: 'text-[11px]' },
  // Étiquette secondaire sur la TV (écran final, sous les prénoms).
  ml: { box: 'min-w-[120px] px-5 py-4 rounded-[16px]', num: 'text-[36px]', score: 'text-[18px]' },
  lg: { box: 'min-w-[220px] px-8 py-8 rounded-[24px]', num: 'text-[64px]', score: 'text-[28px]' },
  xl: { box: 'min-w-[280px] px-10 py-10 rounded-[28px]', num: 'text-[84px]', score: 'text-[34px]' },
} as const

export function PlateTag({ label, size, tilt = false, score, scoreLabel }: {
  label: string; size: keyof typeof SIZES; tilt?: boolean; score?: number | null; scoreLabel?: string
}) {
  const s = SIZES[size]
  return (
    <span
      className={`inline-flex flex-col items-center justify-center bg-[#fffdf9] text-[#2c1f16] shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${s.box}`}
      style={tilt ? { transform: 'rotate(-3deg)' } : undefined}
    >
      {/* whitespace-nowrap : « N° 3 » ne doit jamais se couper sur deux lignes en taille sm. */}
      <span className={`font-display leading-none whitespace-nowrap ${s.num}`}>{label}</span>
      {score != null && scoreLabel && <span className={`mt-1 ${s.score}`}>{scoreLabel}</span>}
    </span>
  )
}
