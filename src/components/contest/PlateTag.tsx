// Étiquette d'assiette crème (spec PR 2 §6-7), la même sur la scène et sur les
// téléphones : « N° X » en grand. Couleurs fixes (crème et chocolat) quel que
// soit le thème : c'est un objet, comme l'étiquette posée sur la table.
// `cookie` (retours d'UAT) : le cookie de marque à côté du numéro — « cookie
// N° X » se comprend mieux qu'un numéro seul ou qu'une icône d'assiette.
const SIZES = {
  sm: { box: 'min-w-[44px] px-2 py-1.5 rounded-[8px]', num: 'text-[15px]', score: 'text-[10px]', cookie: 18 },
  md: { box: 'min-w-[64px] px-3 py-2 rounded-[10px]', num: 'text-[20px]', score: 'text-[11px]', cookie: 24 },
  // Étiquette secondaire sur la TV (écran final, sous les prénoms).
  ml: { box: 'min-w-[120px] px-5 py-4 rounded-[16px]', num: 'text-[36px]', score: 'text-[18px]', cookie: 40 },
  lg: { box: 'min-w-[220px] px-8 py-8 rounded-[24px]', num: 'text-[64px]', score: 'text-[28px]', cookie: 72 },
  xl: { box: 'min-w-[280px] px-10 py-10 rounded-[28px]', num: 'text-[84px]', score: 'text-[34px]', cookie: 96 },
} as const

export function PlateTag({ label, size, tilt = false, cookie = false, score, scoreLabel }: {
  label: string; size: keyof typeof SIZES; tilt?: boolean; cookie?: boolean; score?: number | null; scoreLabel?: string
}) {
  const s = SIZES[size]
  // whitespace-nowrap : « N° 3 » ne doit jamais se couper sur deux lignes en taille sm.
  const number = <span className={`font-display leading-none whitespace-nowrap ${s.num}`}>{label}</span>
  return (
    <span
      className={`inline-flex flex-col items-center justify-center bg-[#fffdf9] text-[#2c1f16] shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${s.box}`}
      style={tilt ? { transform: 'rotate(-3deg)' } : undefined}
    >
      {cookie ? (
        <span className="flex items-center gap-[0.35em]">
          <svg width={s.cookie} height={s.cookie} viewBox="0 0 300 300" aria-hidden="true" className="flex-none">
            <use href="#cmtl-cookie-full" />
          </svg>
          {number}
        </span>
      ) : number}
      {score != null && scoreLabel && <span className={`mt-1 ${s.score}`}>{scoreLabel}</span>}
    </span>
  )
}
