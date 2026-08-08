'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dict, type Lang, type MsgKey } from '@/lib/i18n'

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: MsgKey) => string }>({
  lang: 'fr',
  setLang: () => {},
  t: (k) => dict.fr[k],
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const stored = localStorage.getItem('cmtl_lang')
    // Hydratation volontaire : le SSR rend toujours 'fr', puis le client applique la
    // préférence stockée/navigateur après montage — un useState paresseux lirait
    // localStorage au premier rendu client et casserait l'hydratation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'fr' || stored === 'en') setLangState(stored)
    else if (navigator.language.toLowerCase().startsWith('en')) setLangState('en')
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('cmtl_lang', l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: (k) => dict[lang][k] }}>{children}</LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
