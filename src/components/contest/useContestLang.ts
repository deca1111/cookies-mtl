'use client'

import { useCallback, useEffect, useState } from 'react'
import { contestDict, fmt, type ContestMsgKey } from '@/lib/contest-i18n'
import type { Lang } from '@/lib/i18n'

const KEY = 'cc_concours_lang'

// Langue du concours, CHOISIE explicitement au premier écran (spec §8) — d'où
// une clé distincte de celle de la carte (cmtl_lang), qui, elle, se devine.
// `ready` évite de flasher le sélecteur de langue avant la lecture du stockage.
export function useContestLang() {
  const [lang, setLangState] = useState<Lang | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'fr' || stored === 'en') setLangState(stored)
    setReady(true)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(KEY, l)
  }, [])

  const t = useCallback(
    (k: ContestMsgKey, vars?: Record<string, string | number>) => {
      const s = contestDict[lang ?? 'fr'][k]
      return vars ? fmt(s, vars) : s
    },
    [lang],
  )

  return { ready, lang, setLang, t }
}
